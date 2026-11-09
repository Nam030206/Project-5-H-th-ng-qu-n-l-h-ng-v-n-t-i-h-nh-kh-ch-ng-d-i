import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, ImagePlus, QrCode, Search, Square } from "lucide-react";
import { useToast } from "../lib/context";
import { Button, ErrorBox, Field, Notice, PageHeading } from "../components/UI";
import RecordDetail from "../components/RecordDetail";
function extract(value) {
  try {
    const url = new URL(value),
      hash = url.hash.split("?")[1];
    if (url.protocol === "vanhanh:" && url.hostname === "trip") {
      const trip = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (trip && trip.length <= 10 && !/[<>\r\n/\\]/.test(trip)) return trip;
    }
    const id = new URLSearchParams(hash || url.search).get("trip");
    if (id && id.length <= 10) return id;
  } catch {}
  const id = value.trim();
  if (id && id.length <= 10 && !/[<>\r\n]/.test(id)) return id;
  throw new Error("Mã QR không chứa mã chuyến hợp lệ của Vận Hành.");
}
export default function QrLookup() {
  const [code, setCode] = useState(""),
    [detail, setDetail] = useState(null),
    [camera, setCamera] = useState(false),
    [error, setError] = useState(null),
    stream = useRef(null),
    video = useRef(null),
    animation = useRef(null),
    toast = useToast();
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    cancelAnimationFrame(animation.current);
    setCamera(false);
  }
  function found(value) {
    try {
      const id = extract(value);
      setCode(id);
      setDetail(id);
      setError(null);
      stop();
    } catch (error) {
      setError(error);
    }
  }
  async function start() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Máy ảnh cần localhost hoặc kết nối HTTPS. Bạn có thể chọn ảnh QR để tra cứu.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCamera(true);
    } catch (error) {
      setError(
        new Error(
          error.name === "NotAllowedError"
            ? "Bạn chưa cho phép sử dụng máy ảnh. Có thể chọn ảnh QR hoặc nhập mã chuyến."
            : error.message,
        ),
      );
    }
  }
  useEffect(() => {
    if (!camera) return;
    const element = video.current;
    let stopped = false;
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d", { willReadFrequently: true });
    element.srcObject = stream.current;
    element.play().catch((error) => setError(error));
    function scan() {
      if (stopped) return;
      if (element.readyState >= 2) {
        canvas.width = Math.min(800, element.videoWidth);
        canvas.height =
          (canvas.width * element.videoHeight) / element.videoWidth;
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height),
          result = jsQR(pixels.data, pixels.width, pixels.height);
        if (result) {
          found(result.data);
          return;
        }
      }
      animation.current = requestAnimationFrame(scan);
    }
    animation.current = requestAnimationFrame(scan);
    return () => {
      stopped = true;
      cancelAnimationFrame(animation.current);
    };
  }, [camera]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animation.current);
    },
    [],
  );
  async function image(event) {
    const file = event.target.files[0];
    if (!file) return;
    setError(null);
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.floor(bitmap.width * ratio);
      canvas.height = Math.floor(bitmap.height * ratio);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height),
        result = jsQR(pixels.data, pixels.width, pixels.height);
      if (!result) throw new Error("Không tìm thấy mã QR rõ nét trong ảnh.");
      found(result.data);
    } catch (error) {
      setError(error);
    } finally {
      bitmap?.close();
      event.target.value = "";
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TRA CỨU NHANH"
        title="Tra cứu chuyến bằng QR"
        description="Quét mã bằng máy ảnh, chọn ảnh QR hoặc nhập mã chuyến để xem thông tin."
      />
      <div className="qr-grid">
        <section className="utility-card">
          <div className="utility-icon">
            <QrCode size={25} />
          </div>
          <h2>Tìm chuyến xe</h2>
          <p>
            Mã QR được tạo từ màn hình chi tiết hoặc nút QR ở danh sách chuyến.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              found(code);
            }}
          >
            <Field label="Mã chuyến hoặc nội dung mã QR">
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ví dụ: CX001"
              />
            </Field>
            <Button type="submit" icon={Search} className="mt-5">
              Tra cứu chuyến
            </Button>
          </form>
          <Notice>
            Mã QR chỉ giúp tìm chuyến. Người sử dụng vẫn cần tài khoản và quyền
            xem dữ liệu.
          </Notice>
          <ErrorBox error={error} />
        </section>
        <section className="utility-card">
          <div className="utility-icon">
            <Camera size={24} />
          </div>
          <h2>Quét mã QR</h2>
          <p>Đưa mã vào giữa khung hình hoặc chọn ảnh rõ nét từ thiết bị.</p>
          {camera && (
            <video className="qr-camera" ref={video} playsInline muted />
          )}
          <div className="flex gap-3 flex-wrap mt-5">
            <Button
              variant="secondary"
              icon={camera ? Square : Camera}
              onClick={camera ? stop : start}
            >
              {camera ? "Dừng máy ảnh" : "Bật máy ảnh"}
            </Button>
            <label className="btn btn-secondary cursor-pointer">
              <ImagePlus size={16} />
              Chọn ảnh QR
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={image}
              />
            </label>
          </div>
        </section>
      </div>
      {detail && (
        <RecordDetail
          entity="trips"
          id={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
