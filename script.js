// script.js

let images = [];
let responses = {};       // Stores image responses (keyed by image file name)
let extraResponses = {};  // Stores extra questions responses
let currentIndex = 0;
let userID = "";

// Updated Apps Script CSV uploader URL
const uploadUrl = "https://script.google.com/macros/s/AKfycbxujrzkeZ_n9ZTuVqQSdOGpIbVIq9IUZ0mGiLiRVN5cAcNjSh3K4yvikbrBJoaYFF6l_g/exec";

window.onload = async () => {
  const res = await fetch("images.json");
  images = await res.json();
};

function startSession() {
  userID = document.getElementById("userID").value.trim();
  if (!userID) return alert("Please enter a valid ID");

  const saved = localStorage.getItem("responses_" + userID);
  if (saved) {
    const data = JSON.parse(saved);
    responses = data.responses || {};
    extraResponses = data.extraResponses || {};
    currentIndex = (data.index !== undefined) ? data.index : 0;
  } else {
    images = images.sort(() => 0.5 - Math.random()); // Shuffle images
  }

  document.getElementById("login-section").style.display = "none";
  loadPage();
}

function loadPage() {
  if (currentIndex < images.length) {
    // Show image questionnaire section
    document.getElementById("image-section").style.display = "block";
    document.getElementById("extra-section").style.display = "none";
    loadImage();
  } else {
    // Show extra final questions section
    document.getElementById("image-section").style.display = "none";
    document.getElementById("extra-section").style.display = "block";
    loadExtraQuestions();
  }
}

function loadImage() {
  currentIndex = Math.max(0, Math.min(currentIndex, images.length - 1));
  const img = images[currentIndex];
  document.getElementById("radiograph").src = img.embedUrl;
  document.getElementById("progress").innerText = `Image ${currentIndex + 1} / ${images.length}`;

  // Load saved responses for this image (if any)
  const resp = responses[img.fileName] || {};
  const selQ1 = document.querySelector('input[name="q1"][value="' + (resp.q1 || "") + '"]');
  if (selQ1) selQ1.checked = true;
  else document.querySelectorAll('input[name="q1"]').forEach(r => r.checked = false);
  
  const selQ2 = document.querySelector('input[name="q2"][value="' + (resp.q2 || "") + '"]');
  if (selQ2) selQ2.checked = true;
  else document.querySelectorAll('input[name="q2"]').forEach(r => r.checked = false);
}

function loadExtraQuestions() {
  // Populate extra questions if previously answered
  const selExtra1 = document.querySelector('input[name="extra_q1"][value="' + (extraResponses.q1 || "") + '"]');
  if (selExtra1) selExtra1.checked = true;
  else document.querySelectorAll('input[name="extra_q1"]').forEach(r => r.checked = false);
  
  const selExtra2 = document.querySelector('input[name="extra_q2"][value="' + (extraResponses.q2 || "") + '"]');
  if (selExtra2) selExtra2.checked = true;
  else document.querySelectorAll('input[name="extra_q2"]').forEach(r => r.checked = false);
  
  const selExtra3 = document.querySelector('input[name="extra_q3"][value="' + (extraResponses.q3 || "") + '"]');
  if (selExtra3) selExtra3.checked = true;
  else document.querySelectorAll('input[name="extra_q3"]').forEach(r => r.checked = false);
  
  document.getElementById("extra_q4").value = extraResponses.q4 || "";
  updateSubmitStatus();
}

function saveCurrentResponse() {
  if (currentIndex < images.length) {
    // Save responses for the image questions
    const selectedQ1 = document.querySelector('input[name="q1"]:checked');
    const selectedQ2 = document.querySelector('input[name="q2"]:checked');
    const img = images[currentIndex];
    responses[img.fileName] = {
      q1: selectedQ1 ? selectedQ1.value : "",
      q2: selectedQ2 ? selectedQ2.value : ""
    };
  } else {
    // Save responses for the extra final questions
    const extraQ1 = document.querySelector('input[name="extra_q1"]:checked');
    const extraQ2 = document.querySelector('input[name="extra_q2"]:checked');
    const extraQ3 = document.querySelector('input[name="extra_q3"]:checked');
    extraResponses = {
      q1: extraQ1 ? extraQ1.value : "",
      q2: extraQ2 ? extraQ2.value : "",
      q3: extraQ3 ? extraQ3.value : "",
      q4: document.getElementById("extra_q4").value.trim()
    };
  }
  localStorage.setItem("responses_" + userID, JSON.stringify({ responses, extraResponses, index: currentIndex }));
}

function nextImage() {
  if (currentIndex < images.length) {
    saveCurrentResponse();
    // If at the last image, increment index so extra questions are shown
    if (currentIndex === images.length - 1) {
      currentIndex++;
    } else {
      currentIndex++;
    }
    loadPage();
  }
}

function prevImage() {
  if (currentIndex > 0) {
    saveCurrentResponse();
    currentIndex--;
    loadPage();
  } else {
    alert("This is the first image.");
  }
}

function prevExtra() {
  // From the extra section, go back to the last image
  saveCurrentResponse();
  currentIndex = images.length - 1;
  loadPage();
}

function updateSubmitStatus() {
  let enable = false;
  if (currentIndex >= images.length) {
    // In extra section: ensure all extra questions are answered
    const extraQ1 = document.querySelector('input[name="extra_q1"]:checked');
    const extraQ2 = document.querySelector('input[name="extra_q2"]:checked');
    const extraQ3 = document.querySelector('input[name="extra_q3"]:checked');
    const extraQ4 = document.getElementById("extra_q4").value.trim();
    if (extraQ1 && extraQ2 && extraQ3 && extraQ4 !== "") {
      enable = true;
    }
  }
  document.getElementById("submitBtn").disabled = !enable;
}

// Ensure the submit button state updates on any change in the extra section
document.addEventListener('change', function(e) {
  if (currentIndex >= images.length) {
    updateSubmitStatus();
  }
});

async function submitAll() {
  saveCurrentResponse();

  // Build CSV with new structure:
  // Headers: [UserID, ImageID, AIAnswer, Confidence, HeardAboutAI, KnewChatGPT4o, ConfidenceDiff, SubspecialtyExperience]
  const { csvContent, filename } = buildCSV();

  const form = new URLSearchParams();
  form.append("csv", csvContent);
  form.append("filename", filename);

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      body: form
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

function buildCSV() {
  // New CSV structure:
  // Headers: ["UserID", "ImageID", "AIAnswer", "Confidence", "HeardAboutAI", "KnewChatGPT4o", "ConfidenceDiff", "SubspecialtyExperience"]
  const headers = ["UserID", "ImageID", "AIAnswer", "Confidence", "HeardAboutAI", "KnewChatGPT4o", "ConfidenceDiff", "SubspecialtyExperience"];
  const rows = [];

  // Include responses for each image
  images.forEach(img => {
    const resp = responses[img.fileName] || {};
    rows.push([
      userID,
      img.fileName,
      resp.q1 || "",
      resp.q2 || "",
      "", "", "", ""
    ]);
  });

  // Append the extra questions responses as a separate row
  rows.push([
    userID,
    "Extra",
    "", "",
    extraResponses.q1 || "",
    extraResponses.q2 || "",
    extraResponses.q3 || "",
    extraResponses.q4 || ""
  ]);

  const csvLines = [
    headers.join(","),
    ...rows.map(r =>
      r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    )
  ];

  const csvContent = csvLines.join("\r\n");
  const filename = `responses_step2_${userID}.csv`;
  return { csvContent, filename };
}
