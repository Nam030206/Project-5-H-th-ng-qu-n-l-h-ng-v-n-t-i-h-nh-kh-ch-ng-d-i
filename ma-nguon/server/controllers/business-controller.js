import * as dao from "../dao/business-dao.js";
import * as service from "../services/business-service.js";
import { report, dashboard } from "../services/report-service.js";
import * as files from "../services/file-service.js";
import { AppError } from "../services/validation.js";
import { routeLocations } from "../services/map-service.js";
import { getMapTile, mapTileStatus } from "../services/map-tile-service.js";
export const list = async (request, response) =>
  response.json(await dao.list(request.params.entity, request.query));
export async function detail(request, response) {
  const record = await dao.find(request.params.entity, request.params.id);
  if (!record) throw new AppError(404, "Không tìm thấy bản ghi.");
  const history =
    request.params.entity === "trips"
      ? []
      : await dao.history(request.params.entity, request.params.id);
  response.json({ record, history });
}
export const create = async (request, response) =>
  response
    .status(201)
    .json(
      await service.save(
        request.params.entity,
        null,
        request.body,
        request.user,
      ),
    );
export const update = async (request, response) =>
  response.json(
    await service.save(
      request.params.entity,
      request.params.id,
      request.body,
      request.user,
    ),
  );
export const remove = async (request, response) => {
  await service.destroy(request.params.entity, request.params.id, request.user);
  response.json({ ok: true });
};
export const options = async (request, response) =>
  response.json(await service.options());
export const maintain = async (request, response) =>
  response.json(
    await service.maintenance(request.params.id, request.body, request.user),
  );
export const getReport = async (request, response) =>
  response.json(await report(request.params.type, request.query));
export const getDashboard = async (request, response) =>
  response.json(await dashboard());
export const importFile = async (request, response) =>
  response.json(
    await files.importRows(request.params.entity, request.file, request.user),
  );
async function download(response, rows, name, format) {
  if (rows.length > 10000)
    throw new AppError(
      422,
      "Kết quả vượt 10.000 dòng. Hãy thu hẹp bộ lọc để xuất.",
    );
  const kind = format === "csv" ? "csv" : "xlsx";
  const buffer = Buffer.from(await files.workbookBuffer(rows, kind));
  response.setHeader(
    "Content-Type",
    kind === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${name}.${kind}"`,
  );
  response.send(buffer);
}
export async function exportEntity(request, response) {
  const data = await dao.list(
    request.params.entity,
    request.query,
    undefined,
    true,
  );
  if (data.total > 10000)
    throw new AppError(
      422,
      "Kết quả vượt 10.000 dòng. Hãy thu hẹp bộ lọc để xuất.",
    );
  await download(
    response,
    data.rows,
    request.params.entity,
    request.query.format,
  );
}
export async function exportReport(request, response) {
  const data = await report(request.params.type, request.query);
  await download(
    response,
    data.rows,
    request.params.type,
    request.query.format,
  );
}
export async function exportBackup(request, response) {
  const data = await files.backup(request.user, request.body.password);
  response
    .attachment(`vanhanh-backup-${new Date().toISOString().slice(0, 10)}.json`)
    .json(data);
}
export async function previewBackup(request, response) {
  const data = files.parseBackup(request.file);
  response.json({ createdAt: data.createdAt, counts: data.counts });
}
export const restoreBackup = async (request, response) =>
  response.json(
    await files.restore(
      request.file,
      request.body.password,
      request.body.confirmation,
      request.user,
    ),
  );
export async function map(request, response) {
  const route = await dao.find("routes", request.params.id);
  if (!route) throw new AppError(404, "Không tìm thấy tuyến.");
  response.json(await routeLocations(route));
}
export async function mapTile(request, response) {
  const tile = await getMapTile({ ...request.params, referer: request.get("referer") });
  response.set("Cache-Control", tile.noStore ? "no-store" : `private, max-age=${Math.max(0, Math.floor((tile.expires - Date.now()) / 1000))}`);
  response.type("png").send(tile.bytes);
}
export function mapStatus(request, response) {
  response.set("Cache-Control", "no-store");
  response.json(mapTileStatus(request.params.provider));
}
