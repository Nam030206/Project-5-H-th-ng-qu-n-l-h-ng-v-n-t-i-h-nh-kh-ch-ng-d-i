import * as dao from "../dao/booking-dao.js";
import { clock } from "../dao/business-dao.js";
import * as service from "../services/booking-service.js";

export const meta = async (request, response) =>
  response.json({ clock: await clock() });
export const trips = async (request, response) =>
  response.json(await dao.trips(request.query, request.user));
export const mine = async (request, response) =>
  response.json(await dao.bookings(request.query, request.user));
export const list = async (request, response) =>
  response.json(await dao.bookings(request.query, request.user, true));
export const book = async (request, response) =>
  response.status(201).json(await service.book(request.body, request.user));
export const cancelMine = async (request, response) =>
  response.json(
    await service.cancel(request.params.id, request.body, request.user),
  );
export const cancel = async (request, response) =>
  response.json(
    await service.cancel(request.params.id, request.body, request.user, true),
  );
