/**
 * 2027年度 春の無料体験講座の申込（Googleフォーム用）
 *
 * 置き場所: 申込用Googleフォームの Apps Script
 * ファイル名: Code.gs と Index
 *
 * 初回手順:
 * 1. prepareGoogleForm を実行する
 * 2. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」
 *    実行ユーザー: 自分
 *    アクセスできるユーザー: 全員
 * 3. 発行されたウェブアプリのURLを申込者に案内する
 *
 * 講座・校舎を変えたあとは、コードを保存してウェブアプリを新しいバージョンで更新する。
 * 質問タイトルは変更しない。変えると画面からの送信先が外れる。
 *
 * 1回の申込は、Googleフォームの回答1件になる。
 * 複数講座は「申込講座」に1行ずつ入る。
 * 確認メールの送信元は SENDER_EMAIL。
 * 空欄のときは、ウェブアプリを実行しているGoogleアカウントから送る。
 * 別アドレスにする場合は、そのアカウントのGmail「名前」で確認済みの送信元だけ指定できる。
 * 指定できるアドレスは listSenderAliases を実行すると確認できる。
 */
var PRIVACY_POLICY_URL = "https://be-engineer.tech/privacy_policy";
var SENDER_NAME = "BeEngineer";
var SENDER_EMAIL = "";
var CONSENT_CHOICE = "同意する";
var CONSENT_DECLINE = "同意しない";
var APPLY_PAGE_TITLE = "申込内容";
var DECLINE_PAGE_TITLE = "お申し込みできません";
var FORM_TITLE = "2027年度 春の無料体験講座の申込";
var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
var GRADES = [
  "新中学１年生",
  "新中学２年生",
  "新中学３年生",
  "新高校１年生",
  "新高校２年生",
  "新高校３年生"
];
var QUESTIONS = [
  { title: "個人情報の取り扱いへの同意", type: FormApp.ItemType.MULTIPLE_CHOICE },
  { title: "新学年", type: FormApp.ItemType.MULTIPLE_CHOICE },
  { title: "校舎", type: FormApp.ItemType.MULTIPLE_CHOICE },
  { title: "申込講座", type: FormApp.ItemType.PARAGRAPH_TEXT },
  { title: "参加者氏名", type: FormApp.ItemType.TEXT },
  { title: "学校名", type: FormApp.ItemType.TEXT },
  { title: "メールアドレス", type: FormApp.ItemType.TEXT },
  { title: "電話番号", type: FormApp.ItemType.TEXT }
];

var CATALOG = {
  closeDaysBefore: 2,
  displayMonth: "2027-02",
  commonCourses: [
    { title: "Webページ開発体験", date: "2027-02-06", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-02-07", start: "11:00", end: "12:00" },
    { title: "メェーメェーランゲーム", date: "2027-02-11", start: "14:00", end: "16:00" },
    { title: "Webページ開発体験", date: "2027-02-13", start: "11:00", end: "12:00" },
    { title: "ホワイトハッカー", date: "2027-02-13", start: "14:00", end: "16:00" },
    { title: "バイブコーディング", date: "2027-02-14", start: "11:00", end: "12:00" },
    { title: "Pythonで情報収集自動化", date: "2027-02-14", start: "14:00", end: "16:00" },
    { title: "Webページ開発体験", date: "2027-02-20", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-02-21", start: "11:00", end: "12:00" },
    { title: "ホワイトハッカー", date: "2027-02-23", start: "14:00", end: "16:00" },
    { title: "Webページ開発体験", date: "2027-02-27", start: "11:00", end: "12:00" },
    { title: "バイブコーディング", date: "2027-02-28", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-06", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-07", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-13", start: "11:00", end: "12:00" },
    { title: "バイブコーディング", date: "2027-03-14", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-20", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-21", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-03-27", start: "11:00", end: "12:00" },
    { title: "バイブコーディング", date: "2027-03-28", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-04-03", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-04-04", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-04-10", start: "11:00", end: "12:00" },
    { title: "Webページ開発体験", date: "2027-04-11", start: "11:00", end: "12:00" }
  ],
  campuses: [
    {
      name: "京大本校",
      lineUrl: "https://page.line.me/942ydzjx?oat_content=url&openQrModal=true",
      postalCode: "〒606-8301",
      address: "京都府京都市左京区吉田泉殿町１−３４ ダイショウ百万遍ビル1階",
      access: "出町柳駅から徒歩10分"
    },
    {
      name: "梅田校",
      lineUrl: "https://line.me/R/ti/p/@759lvtlr?openQrModal=true",
      postalCode: "〒530-0012",
      address: "大阪府大阪市北区芝田１丁目４−１４ 芝田町ビル 5F",
      access: "阪急梅田駅（茶屋町口）から徒歩1分"
    },
    {
      name: "飯田橋校",
      lineUrl: "https://line.me/R/ti/p/@028tlecq?oat_content=url&ts=07221501&openQrModal=true",
      postalCode: "〒102-0071",
      address: "東京都千代田区富士見２丁目１２−１３ フィル・パーク Kagulab.IIDABASHI",
      access: "飯田橋駅から徒歩5分"
    },
    {
      name: "横浜校",
      lineUrl: "https://page.line.me/016pbnwr?oat_content=url&openQrModal=true",
      postalCode: "〒220-0012",
      address: "神奈川県横浜市西区みなとみらい 2-2-1 横浜ランドマークタワー 14F",
      access: "みなとみらい駅から徒歩2分"
    },
    {
      name: "首里校",
      lineUrl: "https://line.me/R/ti/p/@153tdlvg?ts=07221502&oat_content=url&openQrModal=true",
      postalCode: "〒903-0806",
      address: "沖縄県那覇市首里汀良町１-２７",
      access: "ゆいレール首里駅から徒歩2分"
    }
  ]
};

function doGet() {
  var template = HtmlService.createTemplateFromFile("Index");
  template.viewJson = JSON.stringify(getViewModel()).replace(/</g, "\\u003c");
  return template.evaluate()
    .setTitle("春の無料体験講座の申込")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function prepareGoogleForm() {
  var form = getForm();
  form.setTitle(FORM_TITLE);
  form.setDescription(formDescription());
  form.setConfirmationMessage("申込ありがとうございました。校舎からのご連絡をお待ちください。");
  trySet(function() { form.setCollectEmail(false); });
  trySet(function() { form.setLimitOneResponsePerUser(false); });
  trySet(function() { form.setPublishingSummary(false); });
  trySet(function() { form.setShowLinkToRespondAgain(false); });
  trySet(function() { form.setAllowResponseEdits(false); });

  QUESTIONS.forEach(function(spec) {
    configureItem(ensureItem(form, spec));
  });
  arrangeFormPages(form);

  var message = "フォームの質問を整えました。個人情報の説明はフォーム冒頭の1か所だけです。ウェブアプリを新しいバージョンで更新してください。";
  Logger.log(message);
  return message;
}

function submitToGoogleForm(data) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(15000);
    if (!locked) {
      return { ok: false, message: "送信が混み合っています。少し待ってから、もう一度お試しください。" };
    }
    var check = validateApplication(data);
    if (!check.ok) return check;
    var form = getForm();
    var response = form.createResponse();
    fillResponse(form, response, check.value);
    response.submit();
    var mailResult = deliverConfirmationMail(check.value);
    return { ok: true, mailSent: mailResult.ok, message: mailResult.message };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  } finally {
    if (locked) {
      try {
        lock.releaseLock();
      } catch (ignore) {}
    }
  }
}

function getViewModel() {
  return {
    grades: GRADES,
    campuses: buildCampuses()
  };
}

function formDescription() {
  return [
    "2027年度 春の無料体験講座のお申し込みです。",
    "",
    "【個人情報の利用について】",
    "お申し込みの際に、新学年・校舎・申込講座・参加者氏名・学校名・メールアドレス・電話番号を取得します。",
    "ご入力いただいた個人情報は、BeEngineer2027春の無料体験講座の受付、ご連絡および当日の運営にのみ使用します。法令に基づく場合を除き、ご本人の同意なく第三者へ提供することはありません。",
    "",
    "プライバシーポリシー",
    PRIVACY_POLICY_URL
  ].join("\n");
}

function getForm() {
  var active = null;
  try {
    active = FormApp.getActiveForm();
  } catch (error) {
    active = null;
  }
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  if (id) return FormApp.openById(id);
  throw new Error("Googleフォームに紐づいたスクリプトから実行してください。スタンドアロンの場合は、スクリプト プロパティ FORM_ID にフォームIDを設定してください。");
}

function ensureItem(form, spec) {
  var item = findItemByTitle(form, spec.title);
  if (item && item.getType() !== spec.type) {
    form.deleteItem(item);
    item = null;
  }
  if (!item) {
    addItem(form, spec.type).setTitle(spec.title);
    item = findItemByTitle(form, spec.title);
  }
  if (!item || item.getType() !== spec.type) {
    throw new Error("「" + spec.title + "」を用意できませんでした。");
  }
  return item;
}

function arrangeFormPages(form) {
  var applyPage = ensurePageBreak(form, APPLY_PAGE_TITLE);
  var declinePage = ensurePageBreak(form, DECLINE_PAGE_TITLE);
  declinePage.setTitle(DECLINE_PAGE_TITLE);
  declinePage.setHelpText("個人情報の取り扱いに同意いただけない場合は、お申し込みできません。");
  trySet(function() { declinePage.setGoToPage(FormApp.PageNavigationType.SUBMIT); });

  placeItem(form, findItemByTitle(form, "個人情報の取り扱いへの同意"), 0);
  placeItem(form, applyPage, 1);
  QUESTIONS.slice(1).forEach(function(spec, index) {
    placeItem(form, findItemByTitle(form, spec.title), index + 2);
  });
  placeItem(form, declinePage, form.getItems().length - 1);

  var consent = findItemByTitle(form, "個人情報の取り扱いへの同意").asMultipleChoiceItem();
  consent.setChoices([
    consent.createChoice(CONSENT_CHOICE, FormApp.PageNavigationType.CONTINUE),
    consent.createChoice(CONSENT_DECLINE, declinePage)
  ]);
}

function ensurePageBreak(form, title) {
  var items = form.getItems(FormApp.ItemType.PAGE_BREAK);
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].getTitle() === title) return items[i].asPageBreakItem();
  }
  return form.addPageBreakItem().setTitle(title);
}

function placeItem(form, item, index) {
  if (item && item.getIndex() !== index) form.moveItem(item, index);
}

function addItem(form, type) {
  if (type === FormApp.ItemType.CHECKBOX) return form.addCheckboxItem();
  if (type === FormApp.ItemType.MULTIPLE_CHOICE) return form.addMultipleChoiceItem();
  if (type === FormApp.ItemType.PARAGRAPH_TEXT) return form.addParagraphTextItem();
  if (type === FormApp.ItemType.TEXT) return form.addTextItem();
  throw new Error("未対応の質問形式です。");
}

function configureItem(item) {
  var title = item.getTitle();
  if (title === "個人情報の取り扱いへの同意") {
    item.asMultipleChoiceItem()
      .setHelpText("")
      .showOtherOption(false)
      .setRequired(true);
    return;
  }
  if (title === "新学年") {
    item.asMultipleChoiceItem()
      .setChoiceValues(GRADES)
      .showOtherOption(false)
      .setRequired(true);
    return;
  }
  if (title === "校舎") {
    item.asMultipleChoiceItem()
      .setChoiceValues(campusNames())
      .showOtherOption(false)
      .setRequired(true);
    return;
  }
  if (title === "申込講座") {
    item.asParagraphTextItem()
      .setHelpText("複数の講座は1行ずつ保存されます。")
      .setRequired(true);
    return;
  }
  if (title === "メールアドレス") {
    item.asTextItem()
      .setHelpText("申込内容の確認メールを、このアドレスへ送信します。")
      .setRequired(true);
    return;
  }
  if (title === "電話番号") {
    item.asTextItem()
      .setHelpText("ハイフンあり・なし、どちらでも入力できます。")
      .setRequired(true);
    return;
  }
  item.asTextItem().setRequired(true);
}

function fillResponse(form, response, data) {
  var consent = requireItem(form, "個人情報の取り扱いへの同意", FormApp.ItemType.MULTIPLE_CHOICE);
  response.withItemResponse(consent.asMultipleChoiceItem().createResponse(data.consent));

  var grade = requireItem(form, "新学年", FormApp.ItemType.MULTIPLE_CHOICE);
  response.withItemResponse(grade.asMultipleChoiceItem().createResponse(data.grade));

  var campus = requireItem(form, "校舎", FormApp.ItemType.MULTIPLE_CHOICE);
  response.withItemResponse(campus.asMultipleChoiceItem().createResponse(data.campus));

  var courses = requireItem(form, "申込講座", FormApp.ItemType.PARAGRAPH_TEXT);
  response.withItemResponse(courses.asParagraphTextItem().createResponse(data.courses.join("\n")));

  var name = requireItem(form, "参加者氏名", FormApp.ItemType.TEXT);
  response.withItemResponse(name.asTextItem().createResponse(data.name));

  var school = requireItem(form, "学校名", FormApp.ItemType.TEXT);
  response.withItemResponse(school.asTextItem().createResponse(data.school));

  var email = requireItem(form, "メールアドレス", FormApp.ItemType.TEXT);
  response.withItemResponse(email.asTextItem().createResponse(data.email));

  var phone = requireItem(form, "電話番号", FormApp.ItemType.TEXT);
  response.withItemResponse(phone.asTextItem().createResponse(data.phone));
}

function requireItem(form, title, type) {
  var item = findItemByTitle(form, title);
  if (!item) {
    throw new Error("フォームに「" + title + "」がありません。prepareGoogleForm を実行してください。");
  }
  if (item.getType() !== type) {
    throw new Error("「" + title + "」の回答形式が違います。prepareGoogleForm を実行してください。");
  }
  return item;
}

function findItemByTitle(form, title) {
  var items = form.getItems();
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

function validateApplication(data) {
  var consent = cleanText(data && data.consent, 20);
  if (consent !== CONSENT_CHOICE) {
    return { ok: false, message: "個人情報の取り扱いに同意いただけない場合は、お申し込みできません。" };
  }

  var grade = cleanText(data.grade, 30);
  var campusName = cleanText(data.campus, 40);
  var name = cleanText(data.name, 50);
  var school = cleanText(data.school, 80);
  var email = normalizeEmail(data.email);
  var phone = cleanText(data.phone, 20);
  if (!grade || GRADES.indexOf(grade) === -1) {
    return { ok: false, message: "新学年を選び直してください。" };
  }
  if (!name) return { ok: false, message: "参加者氏名を入力してください。" };
  if (!school) return { ok: false, message: "学校名を入力してください。" };
  if (!isEmailValid(email)) {
    return { ok: false, message: "メールアドレスを確認してください。" };
  }
  if (!phone || !isPhoneValid(phone)) {
    return { ok: false, message: "電話番号は10桁または11桁で入力してください。" };
  }

  var campus = findOpenCampus(campusName);
  if (!campus) {
    return { ok: false, message: "この校舎は現在申し込みを受け付けていません。校舎を選び直してください。" };
  }

  var courses = uniqueCourses(data.courses, campus);
  if (courses.length === 0) {
    return { ok: false, message: "受講する無料体験講座を選び直してください。" };
  }

  return {
    ok: true,
    value: {
      consent: consent,
      grade: grade,
      campus: campus.name,
      courses: courses,
      name: name,
      school: school,
      email: email,
      phone: phone,
      postalCode: campus.postalCode,
      address: campus.address,
      access: campus.access,
      mapUrl: campus.mapUrl,
      lineUrl: campus.lineUrl
    }
  };
}

function listSenderAliases() {
  var account = Session.getEffectiveUser().getEmail();
  var aliases = GmailApp.getAliases();
  var lines = [
    "実行アカウント: " + account,
    "SENDER_EMAIL に指定できるアドレス:",
    account
  ];
  aliases.forEach(function(alias) {
    lines.push(alias);
  });
  if (aliases.length === 0) {
    lines.push("（追加の送信元はまだありません。Gmailの「名前」から追加してください）");
  }
  var message = lines.join("\n");
  Logger.log(message);
  return message;
}

function deliverConfirmationMail(data) {
  try {
    var sender = resolveSenderEmail();
    if (sender.error) return { ok: false, message: sender.error };
    var subject = "【BeEngineer】2027年度 春の無料体験講座の申込を受け付けました";
    var body = confirmationBody(data);
    if (sender.email) {
      GmailApp.sendEmail(data.email, subject, body, {
        from: sender.email,
        name: SENDER_NAME,
        replyTo: sender.email
      });
    } else {
      MailApp.sendEmail({
        to: data.email,
        subject: subject,
        name: SENDER_NAME,
        body: body
      });
    }
    return { ok: true, message: "" };
  } catch (error) {
    Logger.log(error);
    return { ok: false, message: mailErrorMessage(error) };
  }
}

function resolveSenderEmail() {
  var requested = normalizeEmail(SENDER_EMAIL);
  if (!requested) return { email: "" };
  var account = "";
  try {
    account = normalizeEmail(Session.getEffectiveUser().getEmail());
  } catch (error) {
    account = "";
  }
  if (requested === account) return { email: "" };
  var aliases = GmailApp.getAliases();
  for (var i = 0; i < aliases.length; i += 1) {
    if (normalizeEmail(aliases[i]) === requested) return { email: aliases[i] };
  }
  return {
    error: "申込は保存しました。送信元「" + requested + "」は、このGoogleアカウントの送信元として追加されていません。"
  };
}

function confirmationBody(data) {
  var lines = [
    data.name + " 様",
    "",
    "2027年度 春の無料体験講座のお申し込みを受け付けました。",
    "内容をご確認ください。",
    "",
    "新学年：" + data.grade,
    "校舎：" + data.campus,
    "申込講座："
  ];
  data.courses.forEach(function(course) {
    lines.push("・" + course);
  });
  lines.push(
    "参加者氏名：" + data.name,
    "学校名：" + data.school,
    "メールアドレス：" + data.email,
    "電話番号：" + data.phone,
    ""
  );
  if (data.postalCode || data.address) {
    lines.push("校舎のご案内：");
    if (data.postalCode) lines.push(data.postalCode);
    if (data.address) lines.push(data.address);
    if (data.access) lines.push(data.access);
    if (data.mapUrl) lines.push(data.mapUrl);
    lines.push("");
  }
  if (data.lineUrl) {
    lines.push("今後のご連絡は、" + data.campus + "専用LINEがスムーズです。");
    lines.push(data.lineUrl);
    lines.push("");
  }
  lines.push(data.campus + "からのご連絡をお待ちください。");
  lines.push("このメールは送信専用です。");
  return lines.join("\n");
}

function mailErrorMessage(error) {
  var message = error && error.message ? String(error.message) : "";
  if (/permission|権限|auth|Authorization/i.test(message)) {
    return "申込は保存しました。確認メールの送信権限が未許可のため、メールは届いていません。";
  }
  if (/alias|from address|送信元/i.test(message)) {
    return "申込は保存しました。指定した送信元アドレスからメールを送れませんでした。";
  }
  return "申込は保存しましたが、確認メールを送信できませんでした。";
}

function normalizeEmail(value) {
  return String(value == null ? "" : value)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(character) {
      return String.fromCharCode(character.charCodeAt(0) - 0xFEE0);
    })
    .replace(/＠/g, "@")
    .replace(/[．。]/g, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isEmailValid(value) {
  if (!value || value.length > 254) return false;
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(value);
}

function uniqueCourses(values, campus) {
  var allowed = {};
  campus.courses.forEach(function(course) {
    allowed[course.label] = true;
  });
  var seen = {};
  var courses = [];
  var list = Array.isArray(values) ? values : [];
  for (var i = 0; i < list.length && courses.length < 20; i += 1) {
    var label = cleanText(list[i], 120);
    if (!label || seen[label] || !allowed[label]) continue;
    seen[label] = true;
    courses.push(label);
  }
  if (Array.isArray(values) && values.length !== courses.length) return [];
  return courses;
}

function findOpenCampus(name) {
  var campuses = buildCampuses();
  for (var i = 0; i < campuses.length; i += 1) {
    if (campuses[i].name === name) return campuses[i];
  }
  return null;
}

function campusNames() {
  return (CATALOG.campuses || []).map(function(campus) {
    return campus.name;
  }).filter(function(name) {
    return !!name;
  });
}

function buildCampuses() {
  var closeDaysBefore = Number(CATALOG.closeDaysBefore);
  var deadline = isFinite(closeDaysBefore) ? closeDaysBefore : 2;
  var displayMonth = typeof CATALOG.displayMonth === "string" ? CATALOG.displayMonth : "";
  var commonCourses = Array.isArray(CATALOG.commonCourses) ? CATALOG.commonCourses : [];
  return (CATALOG.campuses || []).map(function(campus) {
    var source = commonCourses.length > 0 ? commonCourses : (campus.courses || []);
    var courses = source.slice().sort(compareCourses).filter(function(course) {
      return course && course.date && course.title &&
        isCourseOpen(course.date, deadline) &&
        isDisplayedMonth(course.date, displayMonth);
    }).map(formatCourse);
    var mapQuery = ((campus.postalCode || "") + " " + (campus.address || "")).trim();
    return {
      name: campus.name,
      lineUrl: campus.lineUrl || "",
      postalCode: campus.postalCode || "",
      address: campus.address || "",
      access: campus.access || "",
      mapUrl: campus.address
        ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQuery)
        : "",
      courses: courses
    };
  }).filter(function(campus) {
    return campus.name && campus.courses.length > 0;
  });
}

function compareCourses(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if ((a.start || "") !== (b.start || "")) return (a.start || "") < (b.start || "") ? -1 : 1;
  return String(a.title || "").localeCompare(String(b.title || ""), "ja");
}

function isDisplayedMonth(dateStr, displayMonth) {
  if (!displayMonth) return true;
  return String(dateStr || "").indexOf(displayMonth + "-") === 0;
}

function isCourseOpen(dateStr, closeDaysBefore) {
  return daysUntilCourse(dateStr) > closeDaysBefore;
}

function daysUntilCourse(dateStr) {
  var parts = String(dateStr || "").split("-");
  if (parts.length !== 3) return -1;
  var courseUtc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return (courseUtc - jstTodayUtc()) / 86400000;
}

function jstTodayUtc() {
  var formatted = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  var parts = formatted.split("-");
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatCourse(course) {
  var parts = String(course.date).split("-");
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  var weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  var isSaturday = weekday === "土";
  var isSunday = weekday === "日";
  var weekdayLabel = isSaturday || isSunday ? weekday : weekday + "・祝";
  var dateText = month + "月" + day + "日";
  var timeText = course.start + "-" + course.end;
  var datetime = dateText + "（" + weekdayLabel + "）" + timeText;
  var start = splitTime(course.start);
  var end = splitTime(course.end);
  return {
    title: course.title,
    dateText: dateText,
    weekdayLabel: weekdayLabel,
    weekdayClass: isSaturday ? "is-saturday" : "is-sunday-or-holiday",
    timeText: timeText,
    datetime: datetime,
    durationMinutes: (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute),
    label: course.title + " " + datetime
  };
}

function splitTime(value) {
  var parts = String(value || "").split(":");
  return {
    hour: Number(parts[0]) || 0,
    minute: Number(parts[1]) || 0
  };
}

function cleanText(value, maxLength) {
  var text = String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
  if (!text || text.length > maxLength) return "";
  return text;
}

function isPhoneValid(value) {
  var digits = String(value || "")
    .replace(/[０-９]/g, function(character) {
      return String.fromCharCode(character.charCodeAt(0) - 0xFEE0);
    })
    .replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function friendlyError(error) {
  var message = error && error.message ? String(error.message) : "";
  if (/not accepting|no longer accepting|回答を受け付けていません/i.test(message)) {
    return "このフォームは現在、回答を受け付けていません。フォームの設定で回答の受付をオンにしてください。";
  }
  if (/Sign-in required|login required|ログイン/i.test(message)) {
    return "フォームがログイン必須になっています。回答の制限を解除してから、もう一度お試しください。";
  }
  if (/invalid choice|does not match/i.test(message)) {
    return "フォームの選択肢と申込内容が一致しません。prepareGoogleForm を実行してから、もう一度お試しください。";
  }
  return message || "送信できませんでした。もう一度お試しください。";
}

function trySet(callback) {
  try {
    callback();
  } catch (error) {
    Logger.log(error);
  }
}
