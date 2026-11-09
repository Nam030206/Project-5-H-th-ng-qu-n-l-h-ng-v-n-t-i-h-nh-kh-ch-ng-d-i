import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { displayValue, fieldLabels } from "../lib/format";
export function Button({
  children,
  variant = "primary",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      {...props}
      disabled={loading || disabled}
    >
      {loading ? (
        <LoaderCircle size={16} className="spin" />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
    </button>
  );
}
export function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={16} />
    </button>
  );
}
export function Badge({ children, tone = "slate" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>{error.message || String(error)}</strong>
        {Array.isArray(error.details) && (
          <ul>
            {error.details.slice(0, 12).map((detail, index) => (
              <li key={index}>
                {detail.row
                  ? `Dòng ${detail.row}: `
                  : detail.field
                    ? `${fieldLabels[detail.field] || detail.field}: `
                    : ""}
                {detail.message}
              </li>
            ))}
          </ul>
        )}
        {retry && (
          <button className="text-link" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
export function Notice({ children }) {
  return (
    <div className="notice">
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Modal({ title, description, onClose, children, wide = false }) {
  const reference = useRef();
  useEffect(() => {
    const dialog = reference.current;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      dialog.close();
    };
  }, []);
  return createPortal(
    <dialog
      ref={reference}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === reference.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <IconButton icon={X} label="Đóng hộp thoại" onClick={onClose} />
      </div>
      <div className="modal-body">{children}</div>
    </dialog>,
    document.body,
  );
}
export function ConfirmDialog({ title, description, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(null);
  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title={title} onClose={() => !loading && onClose()}>
      <p className="muted leading-relaxed">{description}</p>
      <ErrorBox error={error} />
      <div className="form-footer">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Quay lại
        </Button>
        <Button variant="danger" loading={loading} onClick={confirm}>
          Xác nhận xóa
        </Button>
      </div>
    </Modal>
  );
}
export function Field({ label, error, hint, children, span = false }) {
  return (
    <label className={`field ${span ? "field-span" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "indigo",
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}
export function Table({
  columns,
  rows = [],
  loading = false,
  error,
  retry,
  total,
  page: controlledPage,
  onPage,
  pageSize = 10,
  onSearch,
  search,
  searchPlaceholder = "Tìm kiếm nhanh...",
  filters,
  actions,
  rowActions,
  empty = "Chưa có dữ liệu phù hợp.",
  hideSearch = false,
}) {
  const [localPage, setLocalPage] = useState(1),
    [term, setTerm] = useState("");
  const external = total !== undefined,
    query = onSearch ? search || "" : term;
  const filtered = useMemo(
    () =>
      external
        ? rows
        : rows.filter((row) =>
            Object.values(row).some((value) =>
              String(value ?? "")
                .toLocaleLowerCase("vi")
                .includes(query.toLocaleLowerCase("vi")),
            ),
          ),
    [rows, external, query],
  );
  const count = external ? total : filtered.length,
    page = controlledPage || localPage,
    pages = Math.max(1, Math.ceil(count / pageSize));
  useEffect(() => {
    if (page > pages) {
      if (onPage) onPage(pages);
      else setLocalPage(pages);
    }
  }, [page, pages, onPage]);
  const visible = external
    ? filtered
    : filtered.slice((page - 1) * pageSize, page * pageSize);
  const changePage = (value) => (onPage ? onPage(value) : setLocalPage(value));
  return (
    <div className="table-card">
      {(!hideSearch || filters || actions) && (
        <div className="table-toolbar">
          {!hideSearch && (
            <div className="search-control">
              <Search size={17} />
              <input
                aria-label="Tìm kiếm trong bảng"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => {
                  if (onSearch) onSearch(event.target.value);
                  else {
                    setTerm(event.target.value);
                    setLocalPage(1);
                  }
                }}
              />
              {query && (
                <button
                  aria-label="Xóa tìm kiếm"
                  onClick={() => (onSearch ? onSearch("") : setTerm(""))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <div className="table-filters">{filters}</div>
          <div className="table-toolbar-actions">{actions}</div>
        </div>
      )}
      <ErrorBox error={error} retry={retry} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className || ""}>
                  {column.label || fieldLabels[column.key] || column.key}
                </th>
              ))}
              {rowActions && <th className="actions-cell">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        <span className="skeleton" />
                      </td>
                    ))}
                    {rowActions && (
                      <td>
                        <span className="skeleton" />
                      </td>
                    )}
                  </tr>
                ))
              : visible.map((row, index) => (
                  <tr
                    key={
                      row.Id ||
                      row.MaSoChuyenXe ||
                      row.BienSo ||
                      row.CMT ||
                      row.MaTuyen ||
                      index
                    }
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={column.className || ""}>
                        {column.render
                          ? column.render(row[column.key], row)
                          : displayValue(column.key, row[column.key])}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="actions-cell">
                        <div className="row-actions">{rowActions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !visible.length && (
          <div className="empty-state">
            <Inbox size={32} />
            <h3>{empty}</h3>
            <p>Hãy thử điều chỉnh tìm kiếm hoặc bộ lọc.</p>
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {count
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)}`
            : "0"}{" "}
          trong <strong>{count}</strong> bản ghi
          {loading && rows.length ? " · Đang cập nhật…" : ""}
        </span>
        <div className="pagination">
          <IconButton
            icon={ChevronLeft}
            label="Trang trước"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          />
          <span>
            Trang {page} / {pages}
          </span>
          <IconButton
            icon={ChevronRight}
            label="Trang sau"
            disabled={page >= pages}
            onClick={() => changePage(page + 1)}
          />
        </div>
      </div>
    </div>
  );
}
export function DetailsGrid({ record }) {
  return (
    <dl className="details-grid">
      {Object.entries(record).map(([key, value]) => (
        <div key={key}>
          <dt>{fieldLabels[key] || key}</dt>
          <dd>{displayValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ExportButton({ onClick, loading }) {
  return (
    <Button
      variant="secondary"
      icon={ArrowDownToLine}
      onClick={onClick}
      loading={loading}
    >
      Xuất Excel
    </Button>
  );
}
