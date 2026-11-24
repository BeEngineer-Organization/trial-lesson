// GitHub Actionsの envsubst によりビルド時に環境変数が注入されます
const LIFF_ID = "$LIFF_ID";
const GAS_URL = "$GAS_URL";

const GRADES = [
  "新中学１年生",
  "新中学２年生",
  "新中学３年生",
  "新高校１年生",
  "新高校２年生",
  "新高校３年生"
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
let CAMPUSES = [];

let returnToConfirm = false;
let coursesForCampus = "";
let loadingDotsTimer = null;

function showSending() {
  const overlay = document.getElementById("loading-overlay");
  const dots = document.getElementById("loading-dots");
  if (!overlay || !dots) return;
  let count = 1;
  dots.textContent = ".";
  overlay.hidden = false;
  clearInterval(loadingDotsTimer);
  loadingDotsTimer = setInterval(() => {
    count = count % 3 + 1;
    dots.textContent = ".".repeat(count);
  }, 500);
}

function hideSending() {
  clearInterval(loadingDotsTimer);
  loadingDotsTimer = null;
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.hidden = true;
}

function updateStatus(msg) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.className = "";
  statusEl.innerText = msg;
}

function showError(msg) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.className = "error-msg";
  statusEl.innerText = msg;
  statusEl.style.display = "block";
  statusEl.scrollIntoView({ block: "nearest" });
}

function selectedRadio(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function jstTodayUtc() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = type => Number(parts.find(part => part.type === type).value);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}

function daysUntilCourse(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - jstTodayUtc()) / 86400000;
}

function isCourseOpen(dateStr, closeDaysBefore) {
  return daysUntilCourse(dateStr) > closeDaysBefore;
}

function formatCourse(course) {
  const [year, month, day] = course.date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const isSaturday = weekday === "土";
  const isSunday = weekday === "日";
  const weekdayLabel = isSaturday || isSunday ? weekday : (course.holiday ? `${weekday}祝` : weekday);
  const dateText = `${month}月${day}日`;
  const timeText = `${course.start}-${course.end}`;
  const datetime = `${dateText}（${weekdayLabel}）${timeText}`;
  const [startHour, startMinute] = course.start.split(":").map(Number);
  const [endHour, endMinute] = course.end.split(":").map(Number);
  const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  return {
    title: course.title,
    dateText,
    weekdayLabel,
    weekdayClass: isSaturday ? "is-saturday" : (isSunday || course.holiday ? "is-sunday-or-holiday" : ""),
    timeText,
    datetime,
    durationMinutes,
    label: `${course.title} ${datetime}`
  };
}

const LINE_URLS = {
  "京大本校": "https://page.line.me/942ydzjx?oat_content=url&openQrModal=true",
  "梅田校": "https://line.me/R/ti/p/@759lvtlr?openQrModal=true",
  "飯田橋校": "https://line.me/R/ti/p/@028tlecq?oat_content=url&ts=07221501&openQrModal=true",
  "首里校": "https://line.me/R/ti/p/@153tdlvg?ts=07221502&oat_content=url&openQrModal=true"
};

function scheduleDate(year, value) {
  const parts = String(value || "").split("/");
  if (parts.length !== 2) return "";
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  if (!month || !day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function loadCampuses() {
  const response = await fetch(`https://keigo-fujiwara.github.io/new_year_2027_demo/src/new_year_2027/data/schedule.json?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("講座情報を読み込めませんでした。");
  }
  const schedule = await response.json();
  const year = Number(schedule.year);
  const holidays = new Set(Array.isArray(schedule.holidays) ? schedule.holidays : []);
  const items = Array.isArray(schedule.items) ? schedule.items : [];
  const removedCampuses = new Set(["横浜校"]);
  CAMPUSES = (schedule.campuses || []).filter(campus => !campus.hidden && !removedCampuses.has(campus.name)).map(campus => {
    const address = Array.isArray(campus.address) ? campus.address.filter(Boolean).join(" ") : "";
    const access = Array.isArray(campus.access) ? campus.access.filter(Boolean).join(" ") : "";
    const courses = items.filter(item => item.campus === campus.key).map(item => {
      const time = String(item.time || "").split("-");
      const date = scheduleDate(year, item.date);
      const title = (item.events || []).map(event => event.name).filter(Boolean).join("・");
      return {
        title,
        date,
        start: time[0] || "",
        end: time[1] || "",
        holiday: holidays.has(item.date)
      };
    }).filter(course => course.title && course.date && course.start && course.end)
      .sort(compareCourses)
      .filter(course => isCourseOpen(course.date, 2))
      .map(formatCourse);
    return {
      name: campus.name,
      lineUrl: LINE_URLS[campus.name] || "",
      postalCode: campus.zip || "",
      address,
      access,
      mapUrl: address
        ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${campus.zip || ""} ${address}`.trim())
        : "",
      courses
    };
  }).filter(campus => campus.name && campus.courses.length > 0);
}

function compareCourses(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if ((a.start || "") !== (b.start || "")) return (a.start || "") < (b.start || "") ? -1 : 1;
  return (a.title || "").localeCompare(b.title || "", "ja");
}

function findCampus(name) {
  return CAMPUSES.find(campus => campus.name === name) || null;
}

function renderCampusPreview() {
  const campus = findCampus(selectedRadio("campus"));
  const preview = document.getElementById("campus-preview");
  const toggle = document.getElementById("campus-preview-toggle");
  if (!preview || !toggle) return;
  toggle.hidden = !campus;
  toggle.setAttribute("aria-expanded", "false");
  document.getElementById("campus-preview-toggle-label").textContent = "校舎住所を確認する";
  document.getElementById("campus-preview-toggle-icon").textContent = "＋";
  preview.hidden = true;
  if (!campus) return;

  document.getElementById("campus-preview-name").textContent = campus.name;
  const postal = document.getElementById("campus-preview-postal");
  postal.textContent = campus.postalCode;
  postal.hidden = !campus.postalCode;
  document.getElementById("campus-preview-address").textContent = campus.address;
  const access = document.getElementById("campus-preview-access");
  access.textContent = campus.access;
  access.hidden = !campus.access;
  const mapLink = document.getElementById("campus-map-link");
  mapLink.href = campus.mapUrl;
  mapLink.hidden = !campus.mapUrl;
}

function toggleCampusPreview() {
  const preview = document.getElementById("campus-preview");
  const toggle = document.getElementById("campus-preview-toggle");
  const willOpen = preview.hidden;
  preview.hidden = !willOpen;
  toggle.setAttribute("aria-expanded", String(willOpen));
  document.getElementById("campus-preview-toggle-label").textContent =
    willOpen ? "校舎住所を閉じる" : "校舎住所を確認する";
  document.getElementById("campus-preview-toggle-icon").textContent = willOpen ? "−" : "＋";
}

function selectedCourses() {
  const campus = findCampus(selectedRadio("campus"));
  if (!campus) return [];
  return [...document.querySelectorAll("input[name='courses']:checked")]
    .map(input => input.value)
    .filter(value => campus.courses.some(course => course.label === value));
}

function readForm() {
  return {
    grade: selectedRadio("grade"),
    campus: selectedRadio("campus"),
    courses: selectedCourses(),
    name: document.getElementById("participant").value.trim(),
    school: document.getElementById("school").value.trim(),
    phone: document.getElementById("phone").value.trim()
  };
}

function isPhoneValid(value) {
  const digits = String(value || "")
    .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
    .replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function isStepValid(stepNumber) {
  const data = readForm();
  if (stepNumber === 1) return Boolean(data.grade);
  if (stepNumber === 2) return Boolean(data.campus);
  if (stepNumber === 3) return data.courses.length > 0;
  if (stepNumber === 4) return Boolean(data.name);
  if (stepNumber === 5) return Boolean(data.school);
  if (stepNumber === 6) return isPhoneValid(data.phone);
  return true;
}

function refreshNav(step) {
  const nextBtn = step.querySelector(".next-btn");
  if (!nextBtn) return;
  const stepNumber = Number(step.dataset.step);
  nextBtn.disabled = !isStepValid(stepNumber);
  if (returnToConfirm && stepNumber === 2) {
    nextBtn.textContent = "無料体験講座を選ぶ";
  } else if (returnToConfirm) {
    nextBtn.textContent = "確認画面に戻る";
  } else if (stepNumber === 6) {
    nextBtn.textContent = "確認画面へ";
  } else {
    nextBtn.textContent = "次へ進む";
  }
}

function createChoice(type, name, value, checked, course) {
  const label = document.createElement("label");
  label.className = "choice";
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.value = value;
  input.checked = Boolean(checked);
  if (input.checked) label.classList.add("is-selected");
  const text = document.createElement("span");
  if (course) {
    const title = document.createElement("span");
    title.className = "choice-title";
    title.textContent = course.title;
    const datetime = document.createElement("span");
    datetime.className = "choice-datetime";
    appendStyledDatetime(datetime, course);
    text.append(title, datetime);
  } else {
    text.textContent = value;
  }
  input.addEventListener("change", () => {
    if (type === "radio") {
      label.parentElement.querySelectorAll(".choice").forEach(choice => {
        choice.classList.remove("is-selected");
      });
      label.classList.add("is-selected");
    } else {
      label.classList.toggle("is-selected", input.checked);
    }
    if (name === "campus") renderCampusPreview();
    refreshNav(label.closest(".step"));
  });
  label.append(input, text);
  return label;
}

function appendStyledDatetime(container, course) {
  const weekday = document.createElement("span");
  weekday.className = `course-weekday ${course.weekdayClass}`;
  weekday.textContent = course.weekdayLabel;
  container.append(`${course.dateText}（`, weekday, `）${course.timeText}`);
}

function clearCourseSelections() {
  document.querySelectorAll("input[name='courses']").forEach(input => {
    input.checked = false;
    const choice = input.closest(".choice");
    if (choice) choice.classList.remove("is-selected");
  });
}

function renderCourses() {
  const campus = findCampus(selectedRadio("campus"));
  const keep = new Set(selectedCourses());
  const list = document.getElementById("course-list");
  list.replaceChildren();
  if (!campus || campus.courses.length === 0) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "この校舎で申し込みできる無料体験講座はありません。";
    list.appendChild(note);
    refreshNav(document.querySelector(".step[data-step='3']"));
    return;
  }

  const groups = [...new Set(campus.courses.map(course => course.durationMinutes))]
    .sort((a, b) => a - b)
    .map(durationMinutes => {
      if (durationMinutes === 60) return { minutes: "60分", durationMinutes, timeClass: "is-short" };
      if (durationMinutes === 120) return { minutes: "120分", durationMinutes, timeClass: "is-long" };
      return { minutes: `${durationMinutes}分`, durationMinutes, timeClass: "is-other" };
    });

  groups.forEach(group => {
    const courses = campus.courses.filter(course => course.durationMinutes === group.durationMinutes);
    if (courses.length === 0) return;

    const section = document.createElement("section");
    section.className = "course-group";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "course-group-toggle";
    toggle.setAttribute("aria-expanded", "false");
    const title = document.createElement("span");
    const time = document.createElement("span");
    time.className = `course-group-time ${group.timeClass}`;
    time.textContent = group.minutes;
    title.append(time, "コース");
    const icon = document.createElement("span");
    icon.className = "course-group-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "＋";
    toggle.append(title, icon);

    const options = document.createElement("div");
    options.className = "course-group-options";
    options.hidden = true;
    courses.forEach(course => {
      options.appendChild(createChoice("checkbox", "courses", course.label, keep.has(course.label), course));
    });

    const hasSelection = courses.some(course => keep.has(course.label));
    if (hasSelection) {
      options.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      icon.textContent = "−";
    }

    toggle.addEventListener("click", () => {
      const willOpen = options.hidden;
      options.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      icon.textContent = willOpen ? "−" : "＋";
    });

    section.append(toggle, options);
    list.appendChild(section);
  });
  refreshNav(document.querySelector(".step[data-step='3']"));
}

function renderConfirm() {
  const data = readForm();
  const rows = [
    ["新学年", data.grade, 1],
    ["校舎", data.campus, 2],
    ["申込講座", data.courses.join("\n"), 3],
    ["参加者氏名", data.name, 4],
    ["学校名", data.school, 5],
    ["電話番号", data.phone, 6]
  ];
  const list = document.getElementById("confirm-list");
  list.replaceChildren();
  rows.forEach(([label, value, stepNumber]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "confirm-item";
    const labelEl = document.createElement("span");
    labelEl.className = "confirm-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "confirm-value";
    if (stepNumber === 3) {
      appendCourseLines(valueEl, data.courses);
    } else {
      valueEl.textContent = value;
    }
    button.append(labelEl, valueEl);
    button.addEventListener("click", () => {
      returnToConfirm = true;
      showStep(stepNumber);
    });
    list.appendChild(button);
  });
}

function appendCourseLines(container, labels) {
  const campus = findCampus(selectedRadio("campus"));
  labels.forEach(label => {
    const course = campus && campus.courses.find(item => item.label === label);
    const block = document.createElement("span");
    block.className = "confirm-course";
    const title = document.createElement("span");
    title.className = "confirm-course-title";
    title.textContent = course ? course.title : label;
    const datetime = document.createElement("span");
    datetime.className = "confirm-course-datetime";
    if (course && course.datetime) {
      const datetimeLabel = document.createElement("span");
      datetimeLabel.className = "confirm-course-datetime-label";
      datetimeLabel.textContent = "日時";
      datetime.append(datetimeLabel);
      appendStyledDatetime(datetime, course);
    }
    block.append(title, datetime);
    container.appendChild(block);
  });
}

function showStep(stepNumber) {
  document.getElementById("status").style.display = "none";
  document.querySelectorAll(".step").forEach(step => {
    step.classList.toggle("is-active", step.dataset.step === String(stepNumber));
  });
  if (stepNumber === 3) renderCourses();
  if (stepNumber === 2) renderCampusPreview();
  if (stepNumber === 7) renderConfirm();
  const active = document.querySelector(".step.is-active");
  if (active) refreshNav(active);
}

function goNext(step) {
  const stepNumber = Number(step.dataset.step);
  if (!isStepValid(stepNumber)) return;
  if (stepNumber === 2 && selectedRadio("campus") !== coursesForCampus) {
    clearCourseSelections();
  }
  if (stepNumber === 3) {
    coursesForCampus = selectedRadio("campus");
  }
  if (returnToConfirm && stepNumber === 2) {
    showStep(3);
    return;
  }
  if (returnToConfirm || stepNumber >= 6) {
    returnToConfirm = false;
    showStep(7);
    return;
  }
  showStep(stepNumber + 1);
}

function courseParts(label) {
  const campus = findCampus(selectedRadio("campus"));
  const course = campus && campus.courses.find(item => item.label === label);
  if (course) return { title: course.title, datetime: course.datetime };
  return { title: label, datetime: "" };
}

function buildMessage(data) {
  const courses = data.courses.map(label => {
    const course = courseParts(label);
    return course.datetime ? `・${course.title}\n　${course.datetime}` : `・${course.title}`;
  }).join("\n");
  return [
    "【2027年度 春の無料体験講座 申込】",
    `新学年：${data.grade}`,
    `校舎：${data.campus}`,
    "申込講座：",
    courses,
    `参加者氏名：${data.name}`,
    `学校名：${data.school}`,
    `電話番号：${data.phone}`,
    ...campusGuideLines(data.campus)
  ].join("\n");
}

function campusGuideLines(campusName) {
  const campus = findCampus(campusName);
  if (!campus || !campus.address) return [];
  return [
    "校舎のご案内：",
    campus.postalCode,
    campus.address,
    campus.access,
    campus.mapUrl
  ].filter(Boolean);
}

function flexCampusGuide(campusName) {
  const campus = findCampus(campusName);
  if (!campus || !campus.address) return [];
  const contents = [
    { type: "separator" },
    { type: "text", text: "校舎のご案内", size: "sm", color: "#06C755", weight: "bold" }
  ];
  if (campus.postalCode) {
    contents.push({
      type: "text",
      text: campus.postalCode,
      size: "sm",
      color: "#222222",
      wrap: true,
      margin: "sm"
    });
  }
  contents.push({
    type: "text",
    text: campus.address,
    size: "sm",
    color: "#222222",
    wrap: true,
    margin: "sm"
  });
  if (campus.access) {
    contents.push({
      type: "text",
      text: campus.access,
      size: "sm",
      color: "#555555",
      wrap: true,
      margin: "sm"
    });
  }
  if (campus.mapUrl) {
    contents.push({
      type: "button",
      style: "link",
      height: "sm",
      color: "#06C755",
      margin: "md",
      action: { type: "uri", label: "地図を開く", uri: campus.mapUrl }
    });
  }
  return contents;
}

function flexField(label, value) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      { type: "text", text: label, size: "sm", color: "#06C755", weight: "bold" },
      { type: "text", text: value || " ", size: "lg", color: "#222222", wrap: true }
    ]
  };
}

function flexCourse(label, index) {
  const course = courseParts(label);
  const contents = [
    { type: "text", text: course.title, size: "lg", color: "#222222", weight: "bold", wrap: true }
  ];
  if (course.datetime) {
    contents.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "md",
      contents: [
        { type: "text", text: "日時", size: "sm", color: "#0f9b20", weight: "bold", flex: 0 },
        { type: "text", text: course.datetime, size: "md", color: "#222222", wrap: true, flex: 1 }
      ]
    });
  }
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#f4fbf6",
    cornerRadius: "8px",
    paddingAll: "14px",
    margin: index === 0 ? "md" : "lg",
    contents
  };
}

function flexLogo() {
  return {
    type: "image",
    url: "https://beengineer-organization.github.io/trial-lesson/logo_color.png",
    size: "lg",
    aspectRatio: "5:2",
    aspectMode: "fit",
    align: "center"
  };
}

function buildFlexMessage(data) {
  const courseContents = data.courses.map((label, index) => flexCourse(label, index));

  return {
    type: "flex",
    altText: "2027年度 春の無料体験講座の申込を受け付けました",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06C755",
        paddingAll: "18px",
        contents: [
          { type: "text", text: "申込を受け付けました", color: "#FFFFFF", weight: "bold", size: "xl", wrap: true },
          { type: "text", text: "2027年度 春の無料体験講座", color: "#E7FFEF", size: "md", margin: "sm", wrap: true }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        paddingAll: "18px",
        contents: [
          flexLogo(),
          flexField("新学年", data.grade),
          flexField("校舎", data.campus),
          flexField("参加者氏名", data.name),
          flexField("学校名", data.school),
          flexField("電話番号", data.phone),
          { type: "separator" },
          { type: "text", text: "申込講座", size: "sm", color: "#06C755", weight: "bold" },
          ...courseContents,
          ...flexCampusGuide(data.campus),
          { type: "separator" },
          {
            type: "text",
            text: `${data.campus}からのご連絡をお待ちください。`,
            size: "md",
            color: "#555555",
            wrap: true
          }
        ]
      }
    }
  };
}

function showDone(campusName, lineNote) {
  const campus = findCampus(campusName);
  document.getElementById("done-thanks").textContent =
    `申込ありがとうございました。\n${campusName}からのご連絡をお待ちください。${lineNote ? `\n\n${lineNote}` : ""}`;
  document.getElementById("done-guide").textContent =
    `今後のご連絡は、\n${campusName}専用LINE\nで行うとスムーズになります。\n友だち追加をお願いいたします。`;
  const link = document.getElementById("campus-line-link");
  link.href = campus.lineUrl;
  link.textContent = `${campusName}専用LINEを友だち追加する`;
  document.getElementById("apply-flow").style.display = "none";
  document.getElementById("status").style.display = "none";
  document.getElementById("done-step").style.display = "block";
}

function resetForm() {
  returnToConfirm = false;
  coursesForCampus = "";
  document.getElementById("apply-form").reset();
  const submitButton = document.getElementById("submit-btn");
  submitButton.disabled = false;
  submitButton.textContent = "申込";
  document.querySelectorAll(".choice.is-selected").forEach(choice => {
    choice.classList.remove("is-selected");
  });
  renderCampusPreview();
  document.getElementById("done-step").style.display = "none";
  document.getElementById("apply-flow").style.display = "none";
  document.getElementById("consent-step").style.display = "block";
  showStep(1);
}

function liffInClient() {
  try {
    return typeof liff !== "undefined" && !!liff.isInClient && liff.isInClient();
  } catch (error) {
    return false;
  }
}

async function trySendInChat(message, text) {
  if (typeof liff === "undefined" || !liff.sendMessages) {
    return { ok: false, message: "確認メッセージは、LINEのトークから開いたときだけ送れます。" };
  }
  if (!openedFromChat()) {
    return {
      ok: false,
      message: "公式アカウントとのトーク以外から開いたため、トークへは送れませんでした。トーク画面のメニューやメッセージから開いてください。"
    };
  }
  const permissionError = await ensureChatPermission();
  if (permissionError) return { ok: false, message: permissionError };
  const payloads = [];
  if (text) payloads.push([{ type: "text", text: text }]);
  if (message) payloads.push([message]);
  let lastError = "";
  for (let index = 0; index < payloads.length; index += 1) {
    try {
      await liff.sendMessages(payloads[index]);
      return { ok: true, message: "" };
    } catch (error) {
      lastError = error && error.message ? error.message : "";
    }
  }
  if (/permission/i.test(lastError)) {
    lastError = "トークへの送信が許可されていません。「最近使用したサービス」から開き直した場合も送れません。トーク画面から開き直してください。";
  }
  return { ok: false, message: lastError };
}

async function getLineProfile() {
  try {
    const profile = await liff.getProfile();
    return {
      userId: profile.userId || "",
      displayName: profile.displayName || ""
    };
  } catch (err) {
    try {
      const context = liff.getContext ? liff.getContext() : null;
      const decoded = liff.getDecodedIDToken ? liff.getDecodedIDToken() : null;
      return {
        userId: context && context.userId ? context.userId : "",
        displayName: decoded && decoded.name ? decoded.name : ""
      };
    } catch (contextError) {
      return { userId: "", displayName: "" };
    }
  }
}

function requestGas(payload) {
  return fetch(GAS_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("スプレッドシートに保存できませんでした。");
      }
      return response.json();
    })
    .catch(() => requestGasByScript(payload));
}

function requestGasByScript(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `gasCallback_${Date.now()}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("スプレッドシートに保存できませんでした。通信に時間がかかっています。もう一度お試しください。"));
    }, 45000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = result => {
      cleanup();
      resolve(result || {});
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("スプレッドシートに保存できませんでした。Apps Scriptを最新のコードに更新してから、もう一度お試しください。"));
    };
    const params = new URLSearchParams({
      callback: callbackName,
      payload: JSON.stringify(payload)
    });
    script.src = `${GAS_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

async function submitApplication() {
  const data = readForm();
  if (!data.grade || !data.campus || data.courses.length === 0 || !data.name || !data.school || !isPhoneValid(data.phone)) {
    showStep(
      !data.grade ? 1
        : !data.campus ? 2
          : data.courses.length === 0 ? 3
            : !data.name ? 4
              : !data.school ? 5
                : 6
    );
    return;
  }

  const button = document.getElementById("submit-btn");
  button.disabled = true;
  button.textContent = "送信中...";
  showSending();

  let sentInChat = false;
  let lineDelivered = false;
  let lineNote = "";
  try {
    const messageText = buildMessage(data);
    const flexMessage = buildFlexMessage(data);
    const sent = await trySendInChat(flexMessage, messageText);
    sentInChat = sent.ok;
    const sendError = sent.message || "";
    lineDelivered = sentInChat;
    const profile = await getLineProfile();
    const courseDetails = data.courses.map(courseParts);
    const submittedAt = new Date().toISOString();
    for (let index = 0; index < courseDetails.length; index += 1) {
      const course = courseDetails[index];
      const result = await requestGas({
        ...data,
        courses: [data.courses[index]],
        courseTitles: [course.title],
        courseDatetimes: [course.datetime],
        submittedAt,
        lineName: profile.displayName,
        userId: profile.userId,
        messageText,
        flexMessage,
        deliverLine: !sentInChat && index === 0
      });
      if (!result || result.status !== "success") {
        const detail = result && result.message ? result.message : "";
        if (lineDelivered) {
          throw new Error("LINEへは送信しましたが、スプレッドシートに保存できませんでした。もう一度お試しください。");
        }
        throw new Error(detail || "申込を保存できませんでした。");
      }
      if (index === 0 && result.message) lineNote = result.message;
      lineDelivered = lineDelivered || Boolean(result.lineSent);
    }
    const deliveryNote = sentInChat
      ? "確認メッセージは、この申込を開いたトークに送りました。"
      : lineDelivered
        ? "確認メッセージは、このミニアプリの公式アカウントとのトークに届きます。校舎専用LINEとは別のトークです。"
        : [lineNote, sendError, liffDiagnostics()].filter(Boolean).join("\n") || "確認メッセージをトークへ送れませんでした。";
    showDone(data.campus, deliveryNote);
  } catch (err) {
    const detail = err && err.message ? err.message : "送信できませんでした。もう一度お試しください。";
    if (lineDelivered && detail.indexOf("スプレッドシート") === -1) {
      showError("LINEへは送信しましたが、スプレッドシートに保存できませんでした。もう一度お試しください。");
    } else {
      showError(detail);
    }
    button.disabled = false;
    button.textContent = "申込";
  } finally {
    hideSending();
  }
}

function closeLine(event) {
  if (!liffInClient() || !liff.closeWindow) return;
  if (event) event.preventDefault();
  liff.closeWindow();
}

function chatContextType() {
  try {
    const context = liff.getContext ? liff.getContext() : null;
    return context && context.type ? context.type : "";
  } catch (error) {
    return "";
  }
}

function liffDiagnostics() {
  try {
    const context = liff.getContext ? liff.getContext() : null;
    const openedId = context && context.liffId ? context.liffId : "不明";
    const lines = [
      `起動元：${context && context.type ? context.type : "不明"}`,
      `LIFFブラウザ：${liffInClient() ? "はい" : "いいえ"}`,
      `開いたLIFF ID：${openedId}`,
      `設定のLIFF ID：${LIFF_ID}`
    ];
    if (openedId !== "不明" && openedId !== LIFF_ID) {
      lines.push("開いたミニアプリと設定のLIFF IDが違います。");
    }
    return lines.join("\n");
  } catch (error) {
    return "";
  }
}

function openedFromChat() {
  return ["utou", "group", "room"].includes(chatContextType());
}

async function chatPermissionState() {
  if (typeof liff === "undefined" || !liff.permission || !liff.permission.query) return "granted";
  try {
    const status = await liff.permission.query("chat_message.write");
    return status && status.state ? status.state : "granted";
  } catch (error) {
    return "granted";
  }
}

function canRequestPermissionScreen() {
  try {
    return Boolean(liff.isApiAvailable && liff.isApiAvailable("skipChannelVerificationScreen"));
  } catch (error) {
    return false;
  }
}

async function ensureChatPermission() {
  const state = await chatPermissionState();
  if (state === "granted") return "";
  if (state === "unavailable") {
    return "LINE Developersで、このミニアプリのスコープ「chat_message.write」がオフになっています。";
  }
  if (canRequestPermissionScreen()) {
    try {
      await liff.permission.requestAll();
      if (await chatPermissionState() === "granted") return "";
    } catch (error) {}
  }
  return "トークへの送信が許可されていません。LINEのトークを開き直し、許可画面で「許可する」を選んでください。";
}

async function startApplication() {
  if (typeof liff !== "undefined" && openedFromChat()) await ensureChatPermission();
  document.getElementById("consent-step").style.display = "none";
  document.getElementById("apply-flow").style.display = "block";
  showStep(1);
}

function setupForm() {
  const gradeList = document.getElementById("grade-list");
  GRADES.forEach(grade => gradeList.appendChild(createChoice("radio", "grade", grade, false)));

  const campusList = document.getElementById("campus-list");
  CAMPUSES.forEach(campus => campusList.appendChild(createChoice("radio", "campus", campus.name, false)));

  document.querySelectorAll(".next-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      goNext(button.closest(".step"));
    });
  });

  ["participant", "school", "phone"].forEach(id => {
    document.getElementById(id).addEventListener("input", event => {
      refreshNav(event.target.closest(".step"));
    });
  });

  document.getElementById("apply-form").addEventListener("submit", event => {
    event.preventDefault();
  });
  document.getElementById("submit-btn").addEventListener("click", submitApplication);
  document.getElementById("consent-btn").addEventListener("click", startApplication);
  document.getElementById("campus-preview-toggle").addEventListener("click", toggleCampusPreview);
  document.getElementById("restart-btn").addEventListener("click", resetForm);
  document.getElementById("back-btn").addEventListener("click", closeLine);
  document.getElementById("campus-line-link").addEventListener("click", event => {
    const url = event.currentTarget.href;
    if (!url || !liffInClient() || !liff.openWindow) return;
    event.preventDefault();
    liff.openWindow({ url: url, external: true });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  updateStatus("講座情報を読み込み中...");
  loadCampuses()
    .then(() => {
      if (CAMPUSES.length === 0) {
        showError("現在申し込みできる無料体験講座はありません。");
        return;
      }
      setupForm();
      startLiff();
    })
    .catch(err => {
      showError(err && err.message ? err.message : "講座情報を読み込めませんでした。");
    });
});

function startLiff() {
  updateStatus("LINE SDK初期化中...");

  if (typeof liff === "undefined") {
    showError("エラー: LINE SDKの読み込みに失敗しました。");
    return;
  }

  liff.init({ liffId: LIFF_ID })
    .then(() => {
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      showConsent();
    })
    .catch(err => {
      showError(`初期化エラー: ${err.message || err}`);
    });
}

function showConsent() {
  document.getElementById("status").style.display = "none";
  document.getElementById("consent-step").style.display = "block";
}
