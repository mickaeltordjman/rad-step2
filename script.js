// script.js

let images = [];
let responses = {};
let currentIndex = 0;
let userID = "";

// Your Apps Script CSV‑uploader URL
const uploadUrl = "https://script.google.com/macros/s/AKfycbw4sKSxzoLLzJPg8sgcxpbOXScq0QK_qVioD0QwUqhE4ox6nphHyakwl1IgC-axaFaf4w/exec";

window.onload = async () => {
  const res = await fetch("images.json");
  images = await res.json();
  document.getElementById("submitBtn").disabled = true;
};

function startSession() {
  userID = document.getElementById("userID").value.trim();
  if (!userID) return alert("Please enter a valid ID");

  const saved = localStorage.getItem("responses_" + userID);
  if (saved) {
    const data = JSON.parse(saved);
    responses = data.responses;
    currentIndex = data.index || 0;
  } else {
    images = images.sort(() => 0.5 - Math.random());
  }

  document.getElementById("login-section").style.display = "none";
  document.getElementById("questionnaire").style.display = "block";
  loadImage();
}

function loadImage() {
  currentIndex = Math.max(0, Math.min(currentIndex, images.length - 1));

  const img = images[currentIndex];
  document.getElementById("radiograph").src = img.embedUrl;
  document.getElementById("progress").innerText = `Image ${currentIndex + 1} / ${images.length}`;

  const r = responses[img.fileName] || {};
  document.getElementById("q1").value = r.q1 || "";
  document.getElementById("q2").value = r.q2 || "";
  document.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = r.q3 ? r.q3.includes(cb.value) : false;
  });
  document.getElementById("q4").value = r.q4 || "";

  updateSubmitStatus();
}

function saveCurrentResponse() {
  const img = images[currentIndex];
  const q3 = Array.from(document.querySelectorAll("input[type=checkbox]:checked"))
                  .map(cb => cb.value);

  responses[img.fileName] = {
    q1: document.getElementById("q1").value,
    q2: document.getElementById("q2").value,
    q3,
    q4: document.getElementById("q4").value.trim()
  };

  localStorage.setItem("responses_" + userID,
    JSON.stringify({ responses, index: currentIndex }));
}

function nextImage() {
  saveCurrentResponse();
  if (currentIndex < images.length - 1) currentIndex++;
  loadImage();
}

function prevImage() {
  saveCurrentResponse();
  if (currentIndex > 0) currentIndex--;
  loadImage();
}

function updateSubmitStatus() {
  const completed = Object.keys(responses).length;
  document.getElementById("submitBtn").disabled = completed < images.length;
}

async function submitAll() {
  saveCurrentResponse();

  // Build CSV and filename
  const { csvContent, filename } = buildCSV();

  // Prepare form data (no custom headers → no preflight)
  const form = new URLSearchParams();
  form.append("csv",      csvContent);
  form.append("filename", filename);

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      body:   form
    });
    const j = await res.json();
    if (j.success) {
      alert("✅ CSV uploaded to Google Drive!");
      localStorage.removeItem("responses_" + userID);
      location.reload();
    } else {
      throw new Error(j.error);
    }
  } catch (err) {
    console.error("Upload failed:", err);
    alert("❌ Submission failed. Try again later.");
  }
}

// Construct the CSV text and filename
function buildCSV() {
  const headers = ["UserID","ImageID","Q1","Q2","Q3","Q4"];
  const rows = Object.entries(responses).map(([filename, resp]) => [
    userID,
    filename,
    resp.q1 || "",
    resp.q2 || "",
    Array.isArray(resp.q3) ? resp.q3.join(";") : (resp.q3||""),
    resp.q4 || ""
  ]);

  const csvLines = [
    headers.join(","),
    ...rows.map(r =>
      r.map(cell => `"${cell.replace(/"/g,'""')}"`).join(",")
    )
  ];

  const csvContent = csvLines.join("\r\n");
  const filename   = `responses_${userID}.csv`;
  return { csvContent, filename };
}
