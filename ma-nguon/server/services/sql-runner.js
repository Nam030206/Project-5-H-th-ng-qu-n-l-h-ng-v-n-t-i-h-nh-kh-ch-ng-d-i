export function splitSql(source) {
  let delimiter = ";",
    buffer = "",
    quote = null,
    blockComment = false;
  const result = [];
  for (const line of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const directive =
      !quote && !blockComment && line.trim().match(/^DELIMITER\s+(\S+)$/i);
    if (directive) {
      delimiter = directive[1];
      continue;
    }
    for (let index = 0; index < line.length; index++) {
      const character = line[index],
        next = line[index + 1];
      if (blockComment) {
        if (character === "*" && next === "/") {
          blockComment = false;
          index++;
        }
        continue;
      }
      if (!quote && character === "/" && next === "*") {
        blockComment = true;
        index++;
        continue;
      }
      if (
        !quote &&
        (character === "#" ||
          (character === "-" &&
            next === "-" &&
            /\s|$/.test(line[index + 2] || "")))
      )
        break;
      if (quote) {
        buffer += character;
        if (character === "\\" && next) {
          buffer += next;
          index++;
        } else if (character === quote) {
          if (next === quote) {
            buffer += next;
            index++;
          } else quote = null;
        }
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        buffer += character;
        continue;
      }
      if (line.startsWith(delimiter, index)) {
        if (buffer.trim()) result.push(buffer.trim());
        buffer = "";
        index += delimiter.length - 1;
      } else buffer += character;
    }
    buffer += "\n";
  }
  if (quote || blockComment)
    throw new Error("Tệp SQL chứa chuỗi hoặc chú thích chưa đóng.");
  if (buffer.trim()) result.push(buffer.trim());
  return result;
}
export async function executeSql(connection, source) {
  for (const statement of splitSql(source)) await connection.query(statement);
}
