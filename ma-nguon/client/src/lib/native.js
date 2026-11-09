export function printDocument() {
  if (window.desktop)
    return window.desktop
      .print()
      .catch(() =>
        window.alert("Không mở được hộp thoại in. Vui lòng thử lại."),
      );
  return window.print();
}
