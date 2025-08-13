// ---- 假資料（硬編碼） ----
const PATIENT_DB = {
  P1001: {
    id: "P1001",
    name: "王小明",
    sex: "男",
    age: 34,
    allergies: ["青黴素"],
    meds: ["Metformin 500mg BID"],
    diagnosis: "第2型糖尿病",
    note: "餐前監測血糖，低血糖教育已完成",
    emergency: { name: "王媽媽", phone: "0912-345-678" },
  },
  P2002: {
    id: "P2002",
    name: "林怡君",
    sex: "女",
    age: 57,
    allergies: ["花生"],
    meds: ["Amlodipine 5mg QD", "Atorvastatin 20mg QHS"],
    diagnosis: "高血壓、高血脂",
    note: "追蹤血壓日記，每晚10點後服藥",
    emergency: { name: "林先生", phone: "0987-111-222" },
  },
};

// ---- 解析 QR 內容為病患 ID（支援 JSON / URL / 純文字） ----
function parseQR(text) {
  if (!text) return null;
  text = String(text).trim();
  // JSON
  try {
    const data = JSON.parse(text);
    const id = data?.id || data?.patientId;
    if (id) return id;
  } catch (_) {}
  // URL
  try {
    const url = new URL(text);
    const idParam = url.searchParams.get("id") || url.searchParams.get("patientId");
    if (idParam) return idParam;
  } catch (_) {}
  // 純文字
  return text;
}

// ---- 畫面元件 ----
function Badge(content) {
  return `<span class="badge">${content}</span>`;
}

function renderPatientCard(p) {
  return `
  <div class="patient">
    <div class="title">患者資訊 ${Badge("ID：" + p.id)}</div>
    <div class="row">
      <div><div class="label">姓名</div><div><strong>${p.name}</strong></div></div>
      <div><div class="label">性別 / 年齡</div><div><strong>${p.sex}／${p.age}</strong></div></div>
    </div>
    <div><div class="label">診斷</div><div><strong>${p.diagnosis}</strong></div></div>
    <div class="row">
      <div>
        <div class="label">藥物</div>
        <ul class="list">${p.meds.map(m => `<li>${m}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="label">過敏</div>
        <div><strong>${p.allergies.join("、") || "－"}</strong></div>
      </div>
    </div>
    <div><div class="label">備註</div><div><strong>${p.note}</strong></div></div>
    <div><div class="label">緊急聯絡</div><div><strong>${p.emergency.name}（${p.emergency.phone}）</strong></div></div>
  </div>`;
}

// ---- 掃描控制 ----
let html5Qr;
let currentCameraId = null;
const readerEl = document.getElementById("reader");
const cameraSelect = document.getElementById("camera-select");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const rawText = document.getElementById("raw-text");
const parsedIdEl = document.getElementById("parsed-id");
const patientCard = document.getElementById("patient-card");
const emptyHint = document.getElementById("empty-hint");
const fileInput = document.getElementById("file-input");

// 依 rawText 更新畫面
function refreshFromRawText() {
  const id = parseQR(rawText.value);
  parsedIdEl.textContent = id || "－";
  const p = id && PATIENT_DB[id];
  if (p) {
    patientCard.innerHTML = renderPatientCard(p);
    patientCard.classList.remove("hidden");
    emptyHint.classList.add("hidden");
  } else {
    patientCard.classList.add("hidden");
    emptyHint.classList.remove("hidden");
  }
}
rawText.addEventListener("input", refreshFromRawText);

// 初始化鏡頭列表
async function initCameras() {
  try {
    const cams = await Html5Qrcode.getCameras();
    cameraSelect.innerHTML = "";
    cams.forEach((c, i) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label || `Camera ${i+1}`;
      cameraSelect.appendChild(opt);
    });
    if (cams[0]) currentCameraId = cams[0].id;
  } catch (e) {
    console.error(e);
  }
}
cameraSelect.addEventListener("change", e => currentCameraId = e.target.value);

// 開始掃描
btnStart.addEventListener("click", async () => {
  try {
    if (!currentCameraId) await initCameras();
    if (!currentCameraId) return alert("找不到相機裝置，請確認權限與瀏覽器環境。");
    html5Qr = new Html5Qrcode("reader");
    await html5Qr.start(
      { deviceId: { exact: currentCameraId } },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        rawText.value = decodedText;
        refreshFromRawText();
      }
    );
    btnStart.disabled = true;
    btnStop.disabled = false;
  } catch (e) {
    console.error(e);
    alert("啟動相機失敗，請確認裝置授權與 HTTPS。");
  }
});

// 停止掃描
btnStop.addEventListener("click", async () => {
  try {
    if (html5Qr) {
      await html5Qr.stop();
      await html5Qr.clear();
      html5Qr = null;
    }
  } finally {
    btnStart.disabled = false;
    btnStop.disabled = true;
  }
});

// 從圖片檔解析
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    // html5-qrcode 直接解析檔案
    const tmp = new Html5Qrcode(/* element id not required for scanFile */ "reader");
    const res = await tmp.scanFile(file, false);
    await tmp.clear();
    rawText.value = res;
    refreshFromRawText();
  } catch (err) {
    console.error(err);
    alert("無法從影像解析 QR。請換張清晰一點的圖。");
  } finally {
    e.target.value = "";
  }
});

// 產生 demo QR（用 qrcode 套件畫成 dataURL）
function generateDemoQR() {
  const json1 = JSON.stringify({ type: "patient", id: "P1001" });
  const json2 = JSON.stringify({ type: "patient", id: "P2002" });
  QRCode.toDataURL(json1).then(url => { document.getElementById("qr-P1001").src = url; });
  QRCode.toDataURL(json2).then(url => { document.getElementById("qr-P2002").src = url; });
}
generateDemoQR();

// Demo 按鈕行為
document.querySelectorAll("[data-fill]").forEach(btn => {
  btn.addEventListener("click", () => {
    rawText.value = btn.getAttribute("data-fill");
    refreshFromRawText();
  });
});
document.querySelectorAll("[data-fill-json]").forEach(btn => {
  btn.addEventListener("click", () => {
    rawText.value = btn.getAttribute("data-fill-json");
    refreshFromRawText();
  });
});

// 首次載入
initCameras();
refreshFromRawText();
