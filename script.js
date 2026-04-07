const authSessionStorageKey = "jjcareAuthSession";
const unreadStorageKey = "jjcareUnreadCounts";
const adminDraftStorageKey = "jjcareAdminClientDrafts";
const adminClientFilterStorageKey = "jjcareAdminClientFilter";
const localClientsStorageKey = "jjcareLocalClients";
const addClientWebhookUrl = "https://script.google.com/macros/s/AKfycbzdJ2zRCiCn4URXVizGSFkzAxaG4mJqX9IRLW6OZoiOhN2Sv-f3J01zehqXKirxAyetdg/exec";
const portalUsersCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRK0bSuRbXqHmDC48CQgXQ5vIQlneRJP_bETBwS_mesUrms5M4eZMQff7-hjEqRh6A75Hs-xxwjfqLd/pub?output=csv";
const protectedPages = [
  "dashboard.html",
  "messages.html",
  "updates.html",
  "payments.html",
  "profile.html"
];

const firebaseConfig = {
  apiKey: "AIzaSyCPQI_1LhzNnx6Im9yiE2xJV98pFh3os0U",
  authDomain: "jjcare-client-portal.firebaseapp.com",
  projectId: "jjcare-client-portal",
  storageBucket: "jjcare-client-portal.firebasestorage.app",
  messagingSenderId: "1072511472252",
  appId: "1:1072511472252:web:0a6fe533fc657bb778eff9",
  measurementId: "G-5WX0T0QC1Q"
};

const firebaseState = {
  auth: null,
  provider: null,
  signInWithPopup: null,
  signOut: null,
  onAuthStateChanged: null,
  ready: null
};

const portalUsersState = {
  users: null,
  ready: null
};

const readJsonStorage = (key, fallbackValue) => {
  const savedValue = localStorage.getItem(key);

  if (!savedValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(savedValue);
  } catch (error) {
    localStorage.removeItem(key);
    return fallbackValue;
  }
};

const getStoredAuthSession = () => {
  return readJsonStorage(authSessionStorageKey, null);
};

const saveAuthSession = (session) => {
  localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
  localStorage.setItem("jjcareLoggedIn", "true");
  localStorage.setItem("jjcareRole", session.role);
  localStorage.setItem("userEmail", session.email || "");
  localStorage.setItem("userName", session.name || "");
  localStorage.setItem("userPets", JSON.stringify(session.pets || []));

  if (session.role === "client" && session.currentClient) {
    localStorage.setItem("jjcareCurrentClient", session.currentClient);
  } else {
    localStorage.removeItem("jjcareCurrentClient");
  }
};

const clearAuthSession = () => {
  localStorage.removeItem(authSessionStorageKey);
  localStorage.removeItem("jjcareLoggedIn");
  localStorage.removeItem("jjcareRole");
  localStorage.removeItem("jjcareCurrentClient");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  localStorage.removeItem("userPets");
};

const getUnreadCounts = () => {
  return readJsonStorage(unreadStorageKey, {});
};

const setUnreadCounts = (counts) => {
  localStorage.setItem(unreadStorageKey, JSON.stringify(counts));
};

const parsePets = (value) => {
  return String(value || "")
    .split(",")
    .map((pet) => pet.trim())
    .filter(Boolean);
};

const normalizeClientStage = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (["active", "upcoming", "completed", "archived", "not responding", "declined"].includes(normalized)) {
    return normalized;
  }

  return normalized === "inactive" ? "archived" : "active";
};

const formatClientStage = (value) => {
  const normalized = normalizeClientStage(value);

  if (normalized === "not responding") {
    return "Not Responding";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getLocalClients = () => {
  return readJsonStorage(localClientsStorageKey, []);
};

const saveLocalClients = (clients) => {
  localStorage.setItem(localClientsStorageKey, JSON.stringify(clients));
};

const addClientRequiredFieldNames = [
  "addClientEmail",
  "addClientName",
  "addClientPets",
  "addClientStatus",
  "addClientStage",
  "addClientPortalStatus",
  "addClientStartDate",
  "addClientEndDate",
  "addClientNightlyRate",
  "addClientServiceType"
];

const upsertLocalClient = (clientRecord) => {
  const clients = getLocalClients();
  const normalizedEmail = String(clientRecord.email || "").trim().toLowerCase();
  const nextClients = clients.filter((client) => String(client.email || "").trim().toLowerCase() !== normalizedEmail);

  nextClients.push(clientRecord);
  saveLocalClients(nextClients);
};

const resetAddClientForm = (modal) => {
  if (!modal) {
    return;
  }

  modal.querySelectorAll("input, textarea, select").forEach((field) => {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return;
    }

    if (field.name === "addClientRole") {
      field.value = "client";
      return;
    }

    if (field.name === "addClientStatus") {
      field.value = "active";
      return;
    }

    if (field.name === "addClientStage") {
      field.value = "active";
      return;
    }

    if (field.name === "addClientPortalStatus") {
      field.value = "Active";
      return;
    }

    field.value = "";
  });
};

const clearFieldValidationState = (field) => {
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
    return;
  }

  field.classList.remove("admin-control--invalid");
  field.removeAttribute("aria-invalid");
  field.closest(".admin-field")?.classList.remove("admin-field--invalid");
};

const markFieldInvalid = (field) => {
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
    return;
  }

  field.classList.add("admin-control--invalid");
  field.setAttribute("aria-invalid", "true");
  field.closest(".admin-field")?.classList.add("admin-field--invalid");
};

const validateAddClientRequiredFields = (modal) => {
  if (!modal) {
    return false;
  }

  let hasMissingFields = false;

  addClientRequiredFieldNames.forEach((fieldName) => {
    const field = modal.querySelector(`[name="${fieldName}"]`);

    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return;
    }

    const rawValue = field.value;
    const value = fieldName === "addClientPets" ? parsePets(rawValue).join(", ") : String(rawValue || "").trim();

    clearFieldValidationState(field);

    if (!value) {
      hasMissingFields = true;
      markFieldInvalid(field);
    }
  });

  return !hasMissingFields;
};

const getAddClientFormTransport = () => {
  let iframe = document.querySelector("#admin-add-client-submit-frame");

  if (!(iframe instanceof HTMLIFrameElement)) {
    iframe = document.createElement("iframe");
    iframe.id = "admin-add-client-submit-frame";
    iframe.name = "admin-add-client-submit-frame";
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
  }

  let form = document.querySelector("#admin-add-client-submit-form");

  if (!(form instanceof HTMLFormElement)) {
    form = document.createElement("form");
    form.id = "admin-add-client-submit-form";
    form.method = "POST";
    form.target = iframe.name;
    form.hidden = true;
    document.body.appendChild(form);
  }

  form.action = addClientWebhookUrl;
  form.target = iframe.name;
  form.innerHTML = "";

  return { form, iframe };
};

const submitPortalClientFormPost = (payload) => {
  const { form } = getAddClientFormTransport();

  if (payload.action) {
    const actionInput = document.createElement("input");
    actionInput.type = "hidden";
    actionInput.name = "action";
    actionInput.value = String(payload.action);
    form.appendChild(actionInput);
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "action") {
      return;
    }

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value == null ? "" : String(value);
    form.appendChild(input);
  });

  form.submit();
};

const buildClientSheetFormPayload = (clientRecord) => {
  const normalizedClient = normalizeLocalClientRecord(clientRecord);

  return {
    email: normalizedClient.email,
    name: normalizedClient.name,
    pets: normalizedClient.pets.join(", "),
    role: normalizedClient.role,
    status: normalizedClient.status,
    clientStage: normalizedClient.clientStage,
    phone: String(clientRecord.phone || "").trim(),
    area: String(clientRecord.area || "").trim(),
    emergencyContact: String(clientRecord.emergencyContact || "").trim(),
    feedingRoutine: String(clientRecord.feedingRoutine || "").trim(),
    medicationSummary: String(clientRecord.medicationSummary || "").trim(),
    householdNotes: String(clientRecord.householdNotes || "").trim(),
    portalStatus: String(clientRecord.portalStatus || "").trim()
  };
};

const submitAddClientFormPost = (payload) => {
  submitPortalClientFormPost(payload);

  console.log("Add client form submit started");
  console.log("Add client webhook URL:", addClientWebhookUrl);
  console.log("Add client submitted field values:", payload);
};

const submitClientUpdateFormPost = ({ selectedClientName, originalEmail, originalName, payload }) => {
  const matchBy = originalEmail ? "email" : "name";
  const updatePayload = {
    action: "update",
    matchBy,
    originalEmail: originalEmail || "",
    originalName: originalName || "",
    ...payload
  };

  console.log("Submitting EDIT client with action=update");
  const formData = new FormData();
  Object.entries(updatePayload).forEach(([key, value]) => {
    formData.append(key, value == null ? "" : String(value));
  });
  console.log("Edit payload:", Object.fromEntries(formData.entries()));
  console.log("Selected client being edited:", selectedClientName || originalName || payload.name || "");
  console.log("Client update match key used:", matchBy);
  console.log("Client update payload sent:", updatePayload);
  console.log("Client update webhook URL:", addClientWebhookUrl);

  submitPortalClientFormPost(updatePayload);

  console.log("Client update form submission started");
  console.log("Client update success result:", "submitted");

  return { matchBy, updatePayload };
};

const getAdminDrafts = () => {
  return readJsonStorage(adminDraftStorageKey, {});
};

const getAdminClientDraft = (clientKey) => {
  if (!clientKey) {
    return null;
  }

  const drafts = getAdminDrafts();
  return drafts[clientKey] || null;
};

const saveAdminClientDraft = (clientKey, draft) => {
  if (!clientKey) {
    return;
  }

  const drafts = getAdminDrafts();
  drafts[clientKey] = draft;
  localStorage.setItem(adminDraftStorageKey, JSON.stringify(drafts));
};

const deleteAdminClientDraft = (clientKey) => {
  if (!clientKey) {
    return;
  }

  const drafts = getAdminDrafts();
  delete drafts[clientKey];
  localStorage.setItem(adminDraftStorageKey, JSON.stringify(drafts));
};

const removeLocalClientByEmail = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return;
  }

  const nextClients = getLocalClients().filter((client) => String(client.email || "").trim().toLowerCase() !== normalizedEmail);
  saveLocalClients(nextClients);
};

const initializeFirebaseAuth = async () => {
  if (firebaseState.ready) {
    return firebaseState.ready;
  }

  firebaseState.ready = (async () => {
    const firebaseAppModule = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const firebaseAuthModule = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");

    const app = firebaseAppModule.initializeApp(firebaseConfig);
    const auth = firebaseAuthModule.getAuth(app);
    const provider = new firebaseAuthModule.GoogleAuthProvider();

    provider.setCustomParameters({ prompt: "select_account" });

    firebaseState.auth = auth;
    firebaseState.provider = provider;
    firebaseState.signInWithPopup = firebaseAuthModule.signInWithPopup;
    firebaseState.signOut = firebaseAuthModule.signOut;
    firebaseState.onAuthStateChanged = firebaseAuthModule.onAuthStateChanged;

    return firebaseState;
  })();

  return firebaseState.ready;
};

const parseCsv = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.trim() !== ""));
};

const normalizePortalUserRow = (row) => {
  const email = String(row.Email || "").trim().toLowerCase();
  const name = String(row.Name || "").trim();
  const pets = parsePets(row.Pets || "");
  const role = String(row.Role || "").trim().toLowerCase();
  const status = String(row.Status || "").trim().toLowerCase();
  const clientStage = normalizeClientStage(row.ClientStage || row["Client Stage"] || status);

  return {
    email,
    name,
    pets,
    role,
    status,
    clientStage,
    currentClient: role === "client" ? name : ""
  };
};

const normalizeLocalClientRecord = (record) => {
  const email = String(record.email || "").trim().toLowerCase();
  const name = String(record.name || "").trim();
  const pets = Array.isArray(record.pets) ? record.pets.filter(Boolean) : parsePets(record.pets || "");
  const role = String(record.role || "client").trim().toLowerCase() || "client";
  const status = String(record.status || "active").trim().toLowerCase() || "active";
  const clientStage = normalizeClientStage(record.clientStage || "active");

  return {
    ...record,
    email,
    name,
    pets,
    role,
    status,
    clientStage,
    currentClient: role === "client" ? name : ""
  };
};

const mergePortalUsersWithLocalClients = (portalUsers, localClients) => {
  const mergedUsers = { ...portalUsers };

  localClients.forEach((client) => {
    const normalizedClient = normalizeLocalClientRecord(client);

    if (!normalizedClient.email) {
      return;
    }

    mergedUsers[normalizedClient.email] = {
      ...(mergedUsers[normalizedClient.email] || {}),
      ...normalizedClient
    };
  });

  return mergedUsers;
};

const fetchPortalUsers = async () => {
  if (portalUsersState.ready) {
    return portalUsersState.ready;
  }

  portalUsersState.ready = (async () => {
    const response = await fetch(portalUsersCsvUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Portal CSV request failed with status ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    if (rows.length < 2) {
      throw new Error("Portal CSV is empty.");
    }

    const headers = rows[0].map((header) => header.trim());
    const users = {};

    rows.slice(1).forEach((rowValues) => {
      const row = headers.reduce((accumulator, header, index) => {
        accumulator[header] = rowValues[index] || "";
        return accumulator;
      }, {});

      const normalizedUser = normalizePortalUserRow(row);

      if (normalizedUser.email) {
        users[normalizedUser.email] = normalizedUser;
      }
    });

    if (Object.keys(users).length === 0) {
      throw new Error("Portal CSV has no valid users.");
    }

    portalUsersState.users = users;
    console.log("Portal Users:", users);
    console.log(
      "Client List:",
      Object.values(users)
        .filter((user) => user.role === "client")
        .map((user) => user.name)
    );
    return users;
  })().catch((error) => {
    portalUsersState.ready = null;
    throw error;
  });

  return portalUsersState.ready;
};

const getClientList = (portalUsers) => {
  return Object.values(portalUsers)
    .filter((user) => user.role === "client")
    .map((user) => user.name);
};

const getClientRecords = (portalUsers) => {
  return Object.values(portalUsers).filter((user) => user.role === "client");
};

const filterClientRecords = (clientRecords, filterValue) => {
  const normalizedFilter = String(filterValue || "active").trim().toLowerCase();

  if (normalizedFilter === "all") {
    return clientRecords;
  }

  if (normalizedFilter === "active") {
    return clientRecords.filter((client) => ["active", "upcoming"].includes(normalizeClientStage(client.clientStage)));
  }

  return clientRecords.filter((client) => normalizeClientStage(client.clientStage) === normalizedFilter);
};

const getClientRecordByName = (portalUsers, clientName) => {
  return Object.values(portalUsers).find(
    (user) => user.role === "client" && user.name === clientName
  ) || null;
};

const resolveSelectedClientName = (portalUsers, selectedClientName) => {
  const clientList = getClientList(portalUsers);

  if (clientList.length === 0) {
    return "";
  }

  return clientList.includes(selectedClientName) ? selectedClientName : clientList[0];
};

const noDataText = "No data available yet";
const noUpdateText = "No update has been saved for this client yet.";
const noPaymentText = "No payment record has been added yet.";
const noCareText = "No care routine has been entered yet.";
const noProfileText = "No client profile details have been saved yet.";
const noBookingText = "No stay details have been entered yet.";

const getNightCount = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : null;
};

const calculateTotalAmount = (startDate, endDate, nightlyRate) => {
  const nights = getNightCount(startDate, endDate);
  const rate = Number(String(nightlyRate || "").replace(/[^0-9.]/g, ""));

  if (!nights || Number.isNaN(rate) || rate <= 0) {
    return "";
  }

  return (nights * rate).toFixed(2);
};

const formatCurrencyDisplay = (value, { decimals = 2 } = {}) => {
  const normalized = String(value || "").trim();
  const numeric = Number(normalized.replace(/[^0-9.]/g, ""));

  if (!normalized || Number.isNaN(numeric)) {
    return "";
  }

  if (decimals === 0) {
    return `$${Math.round(numeric)}`;
  }

  return `$${numeric.toFixed(decimals)}`;
};

const formatStatus = (status) => {
  const value = String(status || "").trim();

  if (!value) {
    return noDataText;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const buildClientSheetData = (clientRecord) => {
  const clientName = clientRecord?.name || noDataText;
  const petNames = Array.isArray(clientRecord?.pets) && clientRecord.pets.length > 0
    ? clientRecord.pets
    : [noDataText];
  const portalStatus = formatStatus(clientRecord?.portalStatus || clientRecord?.status);
  const startDate = String(clientRecord?.startDate || "").trim();
  const endDate = String(clientRecord?.endDate || "").trim();
  const nightlyRate = String(clientRecord?.nightlyRate || "").trim();
  const totalAmount = String(clientRecord?.totalAmount || calculateTotalAmount(startDate, endDate, nightlyRate)).trim();
  const serviceType = String(clientRecord?.serviceType || "").trim() || noDataText;

  return {
    clientName,
    petNames,
    clientStage: normalizeClientStage(clientRecord?.clientStage),
    portalStatus,
    paymentStatus: noDataText,
    latestUpdate: {
      title: noDataText,
      message: noDataText,
      media: noDataText,
      timestamp: noDataText
    },
    careNotes: {
      feeding: noDataText,
      medication: noDataText,
      walk: noDataText,
      behavior: noDataText
    },
    paymentDetails: {
      service: serviceType,
      amount: totalAmount || noDataText,
      status: noDataText,
      dueDate: noDataText,
      paidDate: noDataText,
      notes: noDataText
    },
    stayDetails: {
      startDate,
      endDate,
      nightlyRate,
      totalAmount,
      serviceType
    },
    profile: {
      email: clientRecord?.email || noDataText,
      clientName,
      petNames: petNames.join(", "),
      phone: noDataText,
      area: noDataText,
      emergencyContact: noDataText,
      feedingRoutine: noDataText,
      medicationSummary: noDataText,
      pottyWalkRoutine: noDataText,
      behaviorNotes: noDataText,
      householdNotes: noDataText,
      portalStatus,
      clientStage: normalizeClientStage(clientRecord?.clientStage)
    },
    checklist: Array.from({ length: 6 }, () => noDataText)
  };
};

const mergeClientSheetData = (baseData, overrideData = {}) => {
  const mergedPets = Array.isArray(overrideData.petNames) && overrideData.petNames.length > 0
    ? overrideData.petNames
    : baseData.petNames;
  const mergedProfile = {
    ...baseData.profile,
    ...(overrideData.profile || {})
  };

  return {
    ...baseData,
    ...overrideData,
    petNames: mergedPets,
    latestUpdate: {
      ...baseData.latestUpdate,
      ...(overrideData.latestUpdate || {})
    },
    careNotes: {
      ...baseData.careNotes,
      ...(overrideData.careNotes || {})
    },
    paymentDetails: {
      ...baseData.paymentDetails,
      ...(overrideData.paymentDetails || {})
    },
    stayDetails: {
      ...baseData.stayDetails,
      ...(overrideData.stayDetails || {})
    },
    profile: {
      ...mergedProfile,
      clientName: mergedProfile.clientName || baseData.clientName,
      petNames: mergedProfile.petNames || mergedPets.join(", "),
      portalStatus: mergedProfile.portalStatus || baseData.portalStatus,
      clientStage: normalizeClientStage(mergedProfile.clientStage || overrideData.clientStage || baseData.clientStage)
    },
    clientStage: normalizeClientStage(overrideData.clientStage || baseData.clientStage),
    checklist: Array.isArray(overrideData.checklist) && overrideData.checklist.length > 0
      ? overrideData.checklist
      : baseData.checklist
  };
};

const buildLocalClientRecordFromData = (clientData, clientKey, fallbackRecord = {}) => {
  return normalizeLocalClientRecord({
    email: clientData.profile.email === noDataText ? clientKey : clientData.profile.email,
    name: clientData.clientName,
    pets: clientData.petNames,
    role: String(fallbackRecord.role || "client").trim().toLowerCase() || "client",
    status: String(clientData.status || fallbackRecord.status || "active").trim().toLowerCase() || "active",
    clientStage: clientData.clientStage,
    portalStatus: clientData.portalStatus,
    phone: clientData.profile.phone,
    area: clientData.profile.area,
    emergencyContact: clientData.profile.emergencyContact,
    feedingRoutine: clientData.profile.feedingRoutine,
    medicationSummary: clientData.profile.medicationSummary,
    pottyWalkRoutine: clientData.profile.pottyWalkRoutine,
    behaviorNotes: clientData.profile.behaviorNotes,
    householdNotes: clientData.profile.householdNotes,
    startDate: clientData.stayDetails.startDate,
    endDate: clientData.stayDetails.endDate,
    nightlyRate: clientData.stayDetails.nightlyRate,
    totalAmount: clientData.stayDetails.totalAmount || clientData.paymentDetails.amount,
    serviceType: clientData.stayDetails.serviceType || clientData.paymentDetails.service
  });
};

const applySignedInUserSession = (user, mappedUser) => {
  const normalizedEmail = user?.email?.toLowerCase().trim();

  if (!normalizedEmail || !mappedUser) {
    clearAuthSession();
    return false;
  }

  saveAuthSession({
    email: normalizedEmail,
    name: mappedUser.name || user.displayName || "",
    pets: mappedUser.pets || [],
    role: mappedUser.role,
    currentClient: mappedUser.currentClient,
    provider: "google"
  });

  return true;
};

const resolvePortalAccess = async (user) => {
  const normalizedEmail = user?.email?.toLowerCase().trim();

  if (!normalizedEmail) {
    return {
      ok: false,
      code: "missing_email",
      message: "We could not read the Google account email."
    };
  }

  try {
    const portalUsers = await fetchPortalUsers();
    const mappedUser = portalUsers[normalizedEmail];

    if (!mappedUser) {
      clearAuthSession();
      return {
        ok: false,
        code: "not_found",
        message: "This Google account is not assigned portal access yet."
      };
    }

    if (mappedUser.status !== "active") {
      clearAuthSession();
      return {
        ok: false,
        code: "inactive",
        message: "Your portal access is currently inactive. Please contact us."
      };
    }

    applySignedInUserSession(user, mappedUser);

    return {
      ok: true,
      user: mappedUser,
      portalUsers
    };
  } catch (error) {
    console.error("Portal user fetch error:", error);
    clearAuthSession();

    return {
      ok: false,
      code: "fetch_failed",
      message: "We could not verify portal access right now. Please try again."
    };
  }
};

window.loginWithGoogle = async function () {
  try {
    const firebaseAuth = await initializeFirebaseAuth();
    const result = await firebaseAuth.signInWithPopup(firebaseAuth.auth, firebaseAuth.provider);
    const portalAccess = await resolvePortalAccess(result.user);

    if (!portalAccess.ok) {
      await firebaseAuth.signOut(firebaseAuth.auth);
      alert(portalAccess.message);
      return;
    }

    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed. Please try again.");
  }
};

window.logoutUser = async function () {
  try {
    const firebaseAuth = await initializeFirebaseAuth();
    await firebaseAuth.signOut(firebaseAuth.auth);
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearAuthSession();
    window.location.href = "index.html";
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("portal-ready");

  const storedSession = getStoredAuthSession();
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  const googleSignInButton = document.querySelector("#googleSignInButton");
  const loginStatus = document.querySelector("#auth-status");
  const logoutButtons = document.querySelectorAll("#logout-button, #mobile-logout-button");
  const mobileMenuButton = document.querySelector("#mobile-menu-button");
  const siteNav = document.querySelector("#site-nav");
  const siteHeader = document.querySelector(".site-header");
  const messagesNavLink = document.querySelector('.site-nav a[href="messages.html"]');
  const loginNavItems = document.querySelectorAll("[data-nav-login]");
  const protectedNavItems = document.querySelectorAll("[data-nav-protected]");
  const authFootnote = document.querySelector("#auth-footnote");
  const inAppBrowserWarning = document.querySelector("#in-app-browser-warning");
  const pageRoleLabels = document.querySelectorAll("#page-role-label");
  const chatThread = document.querySelector("#chat-thread");
  const chatForm = document.querySelector("#chat-form");
  const pagePanel = document.querySelector("main .panel");
  const pageHeading = document.querySelector(".portal-heading");
  const globalToast = document.createElement("div");
  let globalToastTimeoutId;

  globalToast.className = "chat-toast";
  document.body.appendChild(globalToast);

  const showToast = (message) => {
    globalToast.textContent = message;
    globalToast.classList.add("is-visible");
    window.clearTimeout(globalToastTimeoutId);
    globalToastTimeoutId = window.setTimeout(() => {
      globalToast.classList.remove("is-visible");
    }, 2400);
  };

  const setAuthStatus = (message) => {
    if (loginStatus) {
      loginStatus.textContent = message;
    }
  };

  const isMobileViewport = () => window.matchMedia("(max-width: 640px)").matches;

  const closeMobileMenu = () => {
    if (!mobileMenuButton || !siteNav) {
      return;
    }

    mobileMenuButton.classList.remove("is-open");
    mobileMenuButton.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  };

  const isInAppBrowser = () => {
    const userAgent = navigator.userAgent || "";
    return /Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp/i.test(userAgent);
  };

  const updateNavigationVisibility = (isAuthenticated) => {
    loginNavItems.forEach((item) => {
      item.hidden = isAuthenticated;
    });

    protectedNavItems.forEach((item) => {
      item.hidden = !isAuthenticated;
    });

    closeMobileMenu();
  };

  updateNavigationVisibility(Boolean(storedSession?.email));

  if (mobileMenuButton && siteNav) {
    mobileMenuButton.addEventListener("click", () => {
      const isExpanded = mobileMenuButton.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        closeMobileMenu();
        return;
      }

      mobileMenuButton.classList.add("is-open");
      mobileMenuButton.setAttribute("aria-expanded", "true");
      siteNav.classList.add("is-open");
    });

    siteNav.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        closeMobileMenu();
      });
    });

    document.addEventListener("click", (event) => {
      if (!isMobileViewport()) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (siteHeader?.contains(target)) {
        return;
      }

      closeMobileMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (!isMobileViewport()) {
        closeMobileMenu();
      }
    });
  }

  if (inAppBrowserWarning && currentPage === "index.html") {
    inAppBrowserWarning.hidden = !isInAppBrowser();
  }

  if (googleSignInButton && currentPage === "index.html") {
    googleSignInButton.addEventListener("click", () => {
      window.loginWithGoogle();
    });
  }

  let portalUsers = {};
  let adminClients = [];

  try {
    portalUsers = await fetchPortalUsers();
    portalUsers = mergePortalUsersWithLocalClients(portalUsers, getLocalClients());
    adminClients = getClientList(portalUsers);
  } catch (error) {
    console.error("Portal user list error:", error);
    portalUsers = {};
    adminClients = [];

    if (currentPage === "index.html") {
      setAuthStatus("We could not load portal access right now. Please try again.");
    }
  }

  console.log("Portal Users:", portalUsers);
  console.log("Client List:", adminClients);

  const portalRole = storedSession?.role || localStorage.getItem("jjcareRole") || "client";
  const normalizedEmail = String(storedSession?.email || localStorage.getItem("userEmail") || "")
    .trim()
    .toLowerCase();
  const loggedInClientRecord = normalizedEmail ? portalUsers[normalizedEmail] || null : null;
  const isAdminView = portalRole === "admin";
  const adminFilter = isAdminView
    ? String(localStorage.getItem(adminClientFilterStorageKey) || "active").trim().toLowerCase()
    : "active";
  const allClientRecords = getClientRecords(portalUsers);
  const filteredClientRecords = filterClientRecords(allClientRecords, adminFilter);

  adminClients = filteredClientRecords.map((client) => client.name);

  const defaultAdminClient = adminClients[0] || allClientRecords[0]?.name || "";
  const rawSelectedAdminClient = localStorage.getItem("jjcareSelectedClient") || "";
  const dashboardSelectedClient = isAdminView
    ? resolveSelectedClientName(portalUsers, rawSelectedAdminClient || defaultAdminClient)
    : loggedInClientRecord?.name || "";

  if (isAdminView && dashboardSelectedClient && dashboardSelectedClient !== rawSelectedAdminClient) {
    localStorage.setItem("jjcareSelectedClient", dashboardSelectedClient);
  }

  const selectedClientRecord = getClientRecordByName(portalUsers, dashboardSelectedClient);
  const activeClientRecord = isAdminView ? selectedClientRecord : loggedInClientRecord;
  const activeClientKey = activeClientRecord?.email || activeClientRecord?.name || "";
  let activeClientData = mergeClientSheetData(
    buildClientSheetData(activeClientRecord),
    getAdminClientDraft(activeClientKey) || {}
  );
  const clients = allClientRecords;

  console.log("Selected client:", activeClientRecord || null);
  console.log("Clients data:", clients);

  console.log("Current page:", currentPage);
  console.log("Admin selected client:", dashboardSelectedClient);
  console.log("Active client record:", activeClientRecord);

  document.body.classList.toggle("portal-client-mode", !isAdminView);

  const updateMessagesNavBadge = () => {
    if (!messagesNavLink) {
      return;
    }

    const unreadCounts = getUnreadCounts();
    const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    let navBadge = messagesNavLink.querySelector(".nav-badge");

    if (totalUnread > 0) {
      if (!navBadge) {
        navBadge = document.createElement("span");
        navBadge.className = "nav-badge";
        messagesNavLink.appendChild(navBadge);
      }

      navBadge.textContent = totalUnread;
      navBadge.hidden = false;
      return;
    }

    if (navBadge) {
      navBadge.hidden = true;
    }
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  };

  const setListText = (selector, items) => {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = items.join(", ");
    }
  };

  const getPageCopy = () => {
    return {
      "dashboard.html": {
        admin: {
          title: adminClients.length > 0 ? `${activeClientData.clientName}'s Dashboard` : "Dashboard",
          description: adminClients.length > 0
            ? `Manage ${activeClientData.clientName}'s visit details, pet care notes, and daily service communication from one place.`
            : noDataText
        },
        client: {
          title: `${activeClientData.clientName}'s Dashboard`,
          description: activeClientRecord
            ? `Welcome back. Here's the latest overview for ${activeClientData.clientName}'s care and upcoming services.`
            : noDataText
        }
      },
      "messages.html": {
        admin: {
          subtitle: adminClients.length > 0
            ? `Monitor ${activeClientData.clientName}'s conversation and send polished visit updates.`
            : noDataText,
          banner: adminClients.length > 0
            ? `Use messages to share check-ins, visit notes, photos, and reassuring updates for ${activeClientData.clientName} in one organized thread.`
            : noDataText
        },
        client: {
          subtitle: activeClientRecord
            ? `Stay connected with JJ Care through ${activeClientData.clientName}'s private message thread.`
            : noDataText,
          banner: activeClientRecord
            ? `This conversation is reserved for updates, check-ins, and shared media related to ${activeClientData.clientName}'s care.`
            : noDataText
        }
      },
      "updates.html": {
        admin: {
          title: `${activeClientData.clientName}'s Updates`,
          description: `Track visit recaps, care notes, and recent service updates for ${activeClientData.clientName} in one place.`
        },
        client: {
          title: `${activeClientData.clientName}'s Updates`,
          description: activeClientRecord
            ? `Review the latest visit notes, care updates, and shared media for ${activeClientData.clientName}.`
            : noDataText
        }
      },
      "payments.html": {
        admin: {
          title: `${activeClientData.clientName}'s Payments`,
          description: `Review invoices, payment status, and upcoming billing details for ${activeClientData.clientName}.`
        },
        client: {
          title: `${activeClientData.clientName}'s Payments`,
          description: activeClientRecord
            ? `Review invoices, completed payments, and upcoming billing details for ${activeClientData.clientName}.`
            : noDataText
        }
      },
      "profile.html": {
        admin: {
          title: `${activeClientData.clientName} Management Profile`,
          description: `Manage client details, pet care notes, routines, and household information for ${activeClientData.clientName}.`
        },
        client: {
          title: `${activeClientData.clientName}'s Profile`,
          description: activeClientRecord
            ? `View ${activeClientData.clientName}'s profile details, care preferences, and household information.`
            : noDataText
        }
      }
    };
  };

  const openAddClientModal = (mode = "create") => {
    const existingModal = document.querySelector("#admin-add-client-modal");
    const isEditMode = mode === "edit" && Boolean(activeClientRecord);
    const sourceProfile = activeClientData?.profile || {};
    const sourceStayDetails = activeClientData?.stayDetails || {};
    const sourceName = isEditMode
      ? String(sourceProfile.clientName || activeClientData.clientName || activeClientRecord?.name || "").trim()
      : "";
    const sourcePets = isEditMode
      ? (sourceProfile.petNames && sourceProfile.petNames !== noDataText
        ? sourceProfile.petNames
        : (Array.isArray(activeClientData?.petNames) ? activeClientData.petNames.join(", ") : activeClientRecord?.pets?.join(", ") || ""))
      : "";
    const sourceEmail = isEditMode
      ? String(
        sourceProfile.email && sourceProfile.email !== noDataText
          ? sourceProfile.email
          : activeClientRecord?.email || ""
      ).trim().toLowerCase()
      : "";
    const sourcePortalStatus = isEditMode
      ? String(sourceProfile.portalStatus || activeClientData.portalStatus || "Active").trim() || "Active"
      : "Active";
    const sourceStatus = isEditMode
      ? String(activeClientRecord?.status || "active").trim().toLowerCase() || "active"
      : "active";
    const sourceClientStage = isEditMode
      ? normalizeClientStage(sourceProfile.clientStage || activeClientData.clientStage || activeClientRecord?.clientStage || "active")
      : "active";
    const sourceNightlyRate = isEditMode && sourceStayDetails.nightlyRate !== noDataText ? String(sourceStayDetails.nightlyRate || "").trim() : "";
    const sourceStartDate = isEditMode && sourceStayDetails.startDate !== noDataText ? String(sourceStayDetails.startDate || "").trim() : "";
    const sourceEndDate = isEditMode && sourceStayDetails.endDate !== noDataText ? String(sourceStayDetails.endDate || "").trim() : "";
    const sourceTotalAmount = isEditMode
      ? String(sourceStayDetails.totalAmount || calculateTotalAmount(sourceStartDate, sourceEndDate, sourceNightlyRate) || "").trim()
      : calculateTotalAmount("", "", "");
    const sourceServiceType = isEditMode && sourceStayDetails.serviceType !== noDataText ? String(sourceStayDetails.serviceType || "").trim() : "";
    const modalTitle = isEditMode ? "Edit Client" : "Add Client";
    const saveButtonLabel = isEditMode ? "Save Changes" : "Save Client";

    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.className = "admin-modal";
    modal.id = "admin-add-client-modal";
    modal.dataset.mode = isEditMode ? "edit" : "create";

    modal.innerHTML = `
      <div class="admin-modal-backdrop" data-close-add-client="true"></div>
      <div class="admin-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-add-client-title">
        <div class="admin-modal-header">
          <div>
            <p class="portal-kicker">Admin</p>
            <h3 id="admin-add-client-title">${modalTitle}</h3>
          </div>
          <button type="button" class="admin-modal-close" data-close-add-client="true" aria-label="Close">Close</button>
        </div>
        <div class="admin-form-grid admin-form-grid--two" id="admin-add-client-fields"></div>
        <div class="admin-modal-actions">
          <button type="button" class="auth-email-button" data-close-add-client="true">Cancel</button>
          <button type="button" class="auth-submit-button" id="admin-add-client-save">${saveButtonLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fieldHost = modal.querySelector("#admin-add-client-fields");
    const addFields = [
      { label: "Client name", name: "addClientName", value: sourceName, required: true },
      { label: "Email", name: "addClientEmail", value: sourceEmail, type: "email", required: true },
      { label: "Pet names", name: "addClientPets", value: sourcePets, required: true },
      { label: "Role", name: "addClientRole", value: isEditMode ? activeClientRecord?.role || "client" : "client", type: "select", options: ["client", "admin"] },
      { label: "Status", name: "addClientStatus", value: sourceStatus, type: "select", options: ["active", "inactive"], required: true },
      { label: "Client stage", name: "addClientStage", value: sourceClientStage, type: "select", options: ["active", "upcoming", "completed", "archived", "not responding", "declined"], required: true },
      { label: "Portal status", name: "addClientPortalStatus", value: sourcePortalStatus, type: "select", options: ["Active", "Inactive", "Paused", "Pending"], required: true },
      { label: "Phone", name: "addClientPhone", value: isEditMode && sourceProfile.phone !== noDataText ? sourceProfile.phone : "" },
      { label: "Area", name: "addClientArea", value: isEditMode && sourceProfile.area !== noDataText ? sourceProfile.area : "" },
      { label: "Emergency contact", name: "addClientEmergencyContact", value: isEditMode && sourceProfile.emergencyContact !== noDataText ? sourceProfile.emergencyContact : "" },
      { label: "Feeding routine", name: "addClientFeedingRoutine", value: isEditMode && sourceProfile.feedingRoutine !== noDataText ? sourceProfile.feedingRoutine : "", multiline: true },
      { label: "Medication summary", name: "addClientMedicationSummary", value: isEditMode && sourceProfile.medicationSummary !== noDataText ? sourceProfile.medicationSummary : "", multiline: true },
      { label: "Potty or walk routine", name: "addClientPottyWalkRoutine", value: isEditMode && sourceProfile.pottyWalkRoutine !== noDataText ? sourceProfile.pottyWalkRoutine : "", multiline: true },
      { label: "Behavior notes", name: "addClientBehaviorNotes", value: isEditMode && sourceProfile.behaviorNotes !== noDataText ? sourceProfile.behaviorNotes : "", multiline: true },
      { label: "Household notes", name: "addClientHouseholdNotes", value: isEditMode && sourceProfile.householdNotes !== noDataText ? sourceProfile.householdNotes : "", multiline: true },
      { label: "Start date", name: "addClientStartDate", value: sourceStartDate, type: "date", required: true },
      { label: "End date", name: "addClientEndDate", value: sourceEndDate, type: "date", required: true },
      { label: "Nightly rate", name: "addClientNightlyRate", value: sourceNightlyRate, type: "number", required: true },
      { label: "Total amount", name: "addClientTotalAmount", value: sourceTotalAmount, type: "number" },
      { label: "Service type", name: "addClientServiceType", value: sourceServiceType, required: true }
    ];

    addFields.forEach((field) => {
      const fieldNode = createField(field);
      fieldHost.appendChild(fieldNode);
    });

    addClientRequiredFieldNames.forEach((fieldName) => {
      modal.querySelector(`[name="${fieldName}"]`)?.addEventListener("input", (event) => {
        clearFieldValidationState(event.target);
      });
      modal.querySelector(`[name="${fieldName}"]`)?.addEventListener("change", (event) => {
        clearFieldValidationState(event.target);
      });
    });

    const updateAddClientTotal = () => {
      const startDate = modal.querySelector('[name="addClientStartDate"]')?.value || "";
      const endDate = modal.querySelector('[name="addClientEndDate"]')?.value || "";
      const nightlyRate = modal.querySelector('[name="addClientNightlyRate"]')?.value || "";
      const total = calculateTotalAmount(startDate, endDate, nightlyRate);
      const totalInput = modal.querySelector('[name="addClientTotalAmount"]');

      if (totalInput) {
        totalInput.value = total;
      }
    };

    ["addClientStartDate", "addClientEndDate", "addClientNightlyRate"].forEach((fieldName) => {
      modal.querySelector(`[name="${fieldName}"]`)?.addEventListener("input", updateAddClientTotal);
    });

    modal.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.closeAddClient === "true") {
        modal.hidden = true;
      }
    });

    modal.querySelector("#admin-add-client-save")?.addEventListener("click", async () => {
      const isEditing = modal.dataset.mode === "edit";
      const previousEmail = String(activeClientRecord?.email || activeClientKey || "").trim().toLowerCase();
      const previousName = String(activeClientData?.clientName || activeClientRecord?.name || "").trim();
      const startDate = modal.querySelector('[name="addClientStartDate"]')?.value || "";
      const endDate = modal.querySelector('[name="addClientEndDate"]')?.value || "";
      const nightlyRate = modal.querySelector('[name="addClientNightlyRate"]')?.value || "";
      const total = calculateTotalAmount(startDate, endDate, nightlyRate);
      const email = String(modal.querySelector('[name="addClientEmail"]')?.value || "").trim().toLowerCase();
      const name = String(modal.querySelector('[name="addClientName"]')?.value || "").trim();
      const pets = parsePets(modal.querySelector('[name="addClientPets"]')?.value || "");
      const role = modal.querySelector('[name="addClientRole"]')?.value || "client";
      const status = modal.querySelector('[name="addClientStatus"]')?.value || "active";
      const clientStage = modal.querySelector('[name="addClientStage"]')?.value || "active";
      const portalStatus = modal.querySelector('[name="addClientPortalStatus"]')?.value || "Active";
      const phone = modal.querySelector('[name="addClientPhone"]')?.value.trim() || "";
      const area = modal.querySelector('[name="addClientArea"]')?.value.trim() || "";
      const emergencyContact = modal.querySelector('[name="addClientEmergencyContact"]')?.value.trim() || "";
      const feedingRoutine = modal.querySelector('[name="addClientFeedingRoutine"]')?.value.trim() || "";
      const medicationSummary = modal.querySelector('[name="addClientMedicationSummary"]')?.value.trim() || "";
      const pottyWalkRoutine = modal.querySelector('[name="addClientPottyWalkRoutine"]')?.value.trim() || "";
      const behaviorNotes = modal.querySelector('[name="addClientBehaviorNotes"]')?.value.trim() || "";
      const householdNotes = modal.querySelector('[name="addClientHouseholdNotes"]')?.value.trim() || "";
      const serviceType = modal.querySelector('[name="addClientServiceType"]')?.value.trim() || "";
      const saveButton = modal.querySelector("#admin-add-client-save");

      if (!validateAddClientRequiredFields(modal)) {
        showToast("Please fill in all required fields");
        return;
      }

      if (saveButton instanceof HTMLButtonElement) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
      }

      const localClientRecord = normalizeLocalClientRecord({
        email,
        name,
        pets,
        role,
        status,
        clientStage,
        portalStatus,
        phone,
        area,
        emergencyContact,
        feedingRoutine,
        medicationSummary,
        householdNotes,
        startDate,
        endDate,
        nightlyRate,
        totalAmount: total,
        pottyWalkRoutine,
        behaviorNotes,
        serviceType
      });

      try {
        const payload = {
          ...buildClientSheetFormPayload(localClientRecord)
        };

        if (startDate) {
          payload.startDate = startDate;
        }

        if (endDate) {
          payload.endDate = endDate;
        }

        if (nightlyRate) {
          payload.nightlyRate = nightlyRate;
        }

        if (total) {
          payload.totalAmount = total;
        }

        if (serviceType) {
          payload.serviceType = serviceType;
        }

        if (isEditing) {
          submitClientUpdateFormPost({
            selectedClientName: previousName || localClientRecord.name,
            originalEmail: previousEmail,
            originalName: previousName,
            payload: buildClientSheetFormPayload(localClientRecord)
          });
        } else {
          submitAddClientFormPost(payload);
        }
      } catch (error) {
        console.error(isEditing ? "Client update failure result:" : "Add client error details:", error);
        console.error(isEditing ? "Edit client webhook error:" : "Add client webhook error:", error);
        showToast(isEditing ? "Failed to update client" : "Failed to save client");

        if (saveButton instanceof HTMLButtonElement) {
          saveButton.disabled = false;
          saveButton.textContent = isEditing ? "Save Changes" : "Save Client";
        }
        return;
      }

      if (modal.dataset.mode === "edit" && previousEmail && previousEmail !== localClientRecord.email) {
        removeLocalClientByEmail(previousEmail);
        deleteAdminClientDraft(previousEmail);
      }

      upsertLocalClient(localClientRecord);
      saveAdminClientDraft(localClientRecord.email, mergeClientSheetData(buildClientSheetData(localClientRecord), {
        clientName: localClientRecord.name,
        petNames: localClientRecord.pets,
        clientStage: localClientRecord.clientStage,
        portalStatus: localClientRecord.portalStatus || formatStatus(localClientRecord.status),
        paymentDetails: {
          service: localClientRecord.serviceType || noDataText,
          amount: total || noDataText
        },
        stayDetails: {
          startDate,
          endDate,
          nightlyRate,
          totalAmount: total,
          serviceType: localClientRecord.serviceType || noDataText
        },
        profile: {
          clientName: localClientRecord.name,
          petNames: localClientRecord.pets.join(", "),
          email,
          phone: phone || noDataText,
          area: area || noDataText,
          emergencyContact: emergencyContact || noDataText,
          feedingRoutine: feedingRoutine || noDataText,
          medicationSummary: medicationSummary || noDataText,
          pottyWalkRoutine: pottyWalkRoutine || noDataText,
          behaviorNotes: behaviorNotes || noDataText,
          householdNotes: householdNotes || noDataText,
          portalStatus,
          clientStage
        }
      }));

      showToast(isEditing ? "Client updated successfully" : "Client saved successfully");
      resetAddClientForm(modal);
      modal.hidden = true;
      localStorage.setItem(adminClientFilterStorageKey, ["active", "upcoming"].includes(localClientRecord.clientStage) ? "active" : localClientRecord.clientStage);
      localStorage.setItem("jjcareSelectedClient", localClientRecord.name);

      if (saveButton instanceof HTMLButtonElement) {
        saveButton.disabled = false;
        saveButton.textContent = modal.dataset.mode === "edit" ? "Save Changes" : "Save Client";
      }

      window.setTimeout(() => {
        window.location.reload();
      }, 350);
    });
  };

  const createAdminToolbar = (saveHandler) => {
    if (!pagePanel || !pageHeading) {
      return;
    }

    const existingToolbar = pagePanel.querySelector(".admin-toolbar");
    if (existingToolbar) {
      existingToolbar.remove();
    }

    const toolbar = document.createElement("div");
    toolbar.className = "admin-toolbar";

    const left = document.createElement("div");
    left.className = "admin-toolbar-group";

    const filterField = createField({
      label: "View",
      name: "adminClientFilter",
      value: adminFilter,
      type: "select",
      options: ["active", "upcoming", "completed", "archived", "not responding", "all"]
    });

    const clientOptions = filteredClientRecords.length > 0
      ? filteredClientRecords.map((client) => client.name)
      : allClientRecords.map((client) => client.name);
    const clientField = createField({
      label: "Client",
      name: "adminClientSelector",
      value: activeClientData.clientName,
      type: "select",
      options: clientOptions.length > 0 ? clientOptions : [noDataText]
    });

    filterField.querySelector(".admin-field-label").textContent = "Filter";
    clientField.querySelector(".admin-field-label").textContent = "Client";

    filterField.querySelector(".admin-control")?.addEventListener("change", (event) => {
      localStorage.setItem(adminClientFilterStorageKey, event.target.value);
      window.location.reload();
    });

    clientField.querySelector(".admin-control")?.addEventListener("change", (event) => {
      localStorage.setItem("jjcareSelectedClient", event.target.value);
      window.location.reload();
    });

    left.append(filterField, clientField);

    const right = document.createElement("div");
    right.className = "admin-toolbar-group admin-toolbar-group--actions";

    const addClientButton = document.createElement("button");
    addClientButton.type = "button";
    addClientButton.className = "auth-email-button admin-toolbar-button";
    addClientButton.textContent = "Add Client";
    addClientButton.addEventListener("click", () => openAddClientModal("create"));

    right.appendChild(addClientButton);

    if (activeClientRecord) {
      const editClientButton = document.createElement("button");
      editClientButton.type = "button";
      editClientButton.className = "auth-email-button admin-toolbar-button";
      editClientButton.textContent = "Edit Client";
      editClientButton.addEventListener("click", () => openAddClientModal("edit"));
      right.appendChild(editClientButton);
    }

    if (saveHandler) {
      const copy = document.createElement("p");
      copy.className = "admin-toolbar-copy";
      copy.textContent = "Review and save updates for the selected client.";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "auth-submit-button admin-save-button";
      button.textContent = "Save";
      button.addEventListener("click", saveHandler);

      right.append(copy, button);
    }

    toolbar.append(left, right);
    pageHeading.insertAdjacentElement("afterend", toolbar);
  };

  const createField = ({ label, name, value, type = "text", multiline = false, placeholder = noDataText, options = [], required = false }) => {
    const wrapper = document.createElement("label");
    wrapper.className = "admin-field";

    const labelText = document.createElement("span");
    labelText.className = "admin-field-label";
    labelText.textContent = required ? `${label} (Required)` : label;

    let control;

    if (type === "select") {
      control = document.createElement("select");
      options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        option.selected = optionValue === value;
        control.appendChild(option);
      });
    } else if (multiline) {
      control = document.createElement("textarea");
      control.rows = 4;
      control.value = value;
    } else {
      control = document.createElement("input");
      control.type = type;
      control.value = value;
    }

    control.name = name;
    control.placeholder = required && type !== "date" && type !== "select" ? `${placeholder} (Required)` : placeholder;
    control.className = "admin-control";
    control.required = required;
    wrapper.append(labelText, control);
    return wrapper;
  };

  const buildAdminFormGrid = (fields) => {
    const grid = document.createElement("div");
    grid.className = "admin-form-grid";
    fields.forEach((field) => {
      grid.appendChild(createField(field));
    });
    return grid;
  };

  const saveAdminState = (nextPartialData, options = {}) => {
    const {
      syncToSheets = false,
      successMessage = "Saved locally",
      failureMessage = "Failed to update client"
    } = options;
    const previousPersistedClientKey = activeClientData.profile.email && activeClientData.profile.email !== noDataText
      ? activeClientData.profile.email
      : activeClientKey;
    const previousClientName = String(activeClientData.clientName || activeClientRecord?.name || "").trim();
    const nextActiveClientData = mergeClientSheetData(activeClientData, nextPartialData);
    const persistedClientKey = nextActiveClientData.profile.email && nextActiveClientData.profile.email !== noDataText
      ? nextActiveClientData.profile.email
      : activeClientKey;

    if (syncToSheets) {
      const clientRecordForSync = buildLocalClientRecordFromData(nextActiveClientData, persistedClientKey, activeClientRecord || {});

      try {
        submitClientUpdateFormPost({
          selectedClientName: previousClientName || clientRecordForSync.name,
          originalEmail: previousPersistedClientKey,
          originalName: previousClientName,
          payload: buildClientSheetFormPayload(clientRecordForSync)
        });
      } catch (error) {
        console.error("Client update failure result:", error);
        showToast(failureMessage);
        return;
      }
    }

    activeClientData = nextActiveClientData;

    if (previousPersistedClientKey && previousPersistedClientKey !== persistedClientKey) {
      deleteAdminClientDraft(previousPersistedClientKey);
      removeLocalClientByEmail(previousPersistedClientKey);
    }
    saveAdminClientDraft(persistedClientKey, activeClientData);
    upsertLocalClient(buildLocalClientRecordFromData(activeClientData, persistedClientKey, activeClientRecord || {}));
    if (activeClientData.clientName && activeClientData.clientName !== noDataText) {
      localStorage.setItem("jjcareSelectedClient", activeClientData.clientName);
    }
    showToast(successMessage);
    window.setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const renderDashboardAdminEditor = () => {
    createAdminToolbar(null);
  };

  const renderUpdatesAdminEditor = () => {
    const latestCard = document.querySelector(".portal-grid.portal-grid--two .info-card:nth-child(1)");
    const detailsCard = document.querySelector(".portal-grid.portal-grid--two .info-card:nth-child(2)");

    createAdminToolbar(() => {
      saveAdminState({
        latestUpdate: {
          title: document.querySelector('[name="updatesTitle"]')?.value.trim() || noDataText,
          message: document.querySelector('[name="updatesMessage"]')?.value.trim() || noDataText,
          media: document.querySelector('[name="updatesMedia"]')?.value.trim() || noDataText,
          timestamp: document.querySelector('[name="updatesTimestamp"]')?.value.trim() || noDataText
        }
      });
    });

    if (latestCard) {
      latestCard.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Update Details";
      const grid = buildAdminFormGrid([
        { label: "Update title", name: "updatesTitle", value: activeClientData.latestUpdate.title },
        { label: "Update message", name: "updatesMessage", value: activeClientData.latestUpdate.message, multiline: true }
      ]);
      latestCard.append(title, grid);
    }

    if (detailsCard) {
      detailsCard.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Media and Timing";
      const grid = buildAdminFormGrid([
        { label: "Media link", name: "updatesMedia", value: activeClientData.latestUpdate.media, type: "url" },
        { label: "Timestamp", name: "updatesTimestamp", value: activeClientData.latestUpdate.timestamp }
      ]);
      detailsCard.append(title, grid);
    }
  };

  const renderPaymentsAdminEditor = () => {
    const primaryCard = document.querySelector(".portal-grid.portal-grid--two .info-card:nth-child(1)");
    const secondaryCard = document.querySelector(".portal-grid.portal-grid--two .info-card:nth-child(2)");

    createAdminToolbar(() => {
      const paymentStatus = document.querySelector('[name="paymentRecordStatus"]')?.value.trim() || noDataText;
      const startDate = document.querySelector('[name="paymentStartDate"]')?.value.trim() || "";
      const endDate = document.querySelector('[name="paymentEndDate"]')?.value.trim() || "";
      const nightlyRate = document.querySelector('[name="paymentNightlyRate"]')?.value.trim() || "";
      const manualTotalAmount = document.querySelector('[name="paymentAmount"]')?.value.trim() || "";
      const totalAmount = manualTotalAmount || calculateTotalAmount(startDate, endDate, nightlyRate);
      const serviceType = document.querySelector('[name="paymentServiceType"]')?.value.trim() || noDataText;

      saveAdminState({
        paymentStatus,
        paymentDetails: {
          service: serviceType,
          amount: totalAmount || document.querySelector('[name="paymentAmount"]')?.value.trim() || noDataText,
          status: paymentStatus,
          dueDate: document.querySelector('[name="paymentDueDate"]')?.value.trim() || noDataText,
          paidDate: document.querySelector('[name="paymentPaidDate"]')?.value.trim() || noDataText,
          notes: document.querySelector('[name="paymentNotes"]')?.value.trim() || noDataText
        },
        stayDetails: {
          startDate,
          endDate,
          nightlyRate,
          totalAmount,
          serviceType
        }
      });
    });

    if (primaryCard) {
      primaryCard.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Payment Record";
      const grid = buildAdminFormGrid([
        { label: "Service type", name: "paymentServiceType", value: activeClientData.stayDetails.serviceType || activeClientData.paymentDetails.service },
        { label: "Total amount", name: "paymentAmount", value: activeClientData.stayDetails.totalAmount || activeClientData.paymentDetails.amount, type: "number" },
        {
          label: "Status",
          name: "paymentRecordStatus",
          value: activeClientData.paymentDetails.status || activeClientData.paymentStatus,
          type: "select",
          options: ["Paid", "Pending", "Overdue", "Partial", noDataText]
        }
      ]);
      primaryCard.append(title, grid);
    }

    if (secondaryCard) {
      secondaryCard.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Billing Dates and Notes";
      const grid = buildAdminFormGrid([
        { label: "Start date", name: "paymentStartDate", value: activeClientData.stayDetails.startDate, type: "date" },
        { label: "End date", name: "paymentEndDate", value: activeClientData.stayDetails.endDate, type: "date" },
        { label: "Nightly rate", name: "paymentNightlyRate", value: activeClientData.stayDetails.nightlyRate, type: "number" },
        { label: "Due date", name: "paymentDueDate", value: activeClientData.paymentDetails.dueDate, type: "text" },
        { label: "Paid date", name: "paymentPaidDate", value: activeClientData.paymentDetails.paidDate, type: "text" },
        { label: "Notes", name: "paymentNotes", value: activeClientData.paymentDetails.notes, multiline: true }
      ]);
      secondaryCard.append(title, grid);

      const syncTotal = () => {
        const startDate = document.querySelector('[name="paymentStartDate"]')?.value.trim() || "";
        const endDate = document.querySelector('[name="paymentEndDate"]')?.value.trim() || "";
        const nightlyRate = document.querySelector('[name="paymentNightlyRate"]')?.value.trim() || "";
        const total = calculateTotalAmount(startDate, endDate, nightlyRate);
        const totalField = document.querySelector('[name="paymentAmount"]');

        if (totalField && totalField.dataset.manualOverride !== "true") {
          totalField.value = total;
        }
      };

      ["paymentStartDate", "paymentEndDate", "paymentNightlyRate"].forEach((fieldName) => {
        document.querySelector(`[name="${fieldName}"]`)?.addEventListener("input", syncTotal);
      });

      document.querySelector('[name="paymentAmount"]')?.addEventListener("input", (event) => {
        event.target.dataset.manualOverride = event.target.value.trim() ? "true" : "false";
      });
    }
  };

  const renderProfileAdminEditor = () => {
    const cards = Array.from(document.querySelectorAll(".portal-grid .info-card"));

    createAdminToolbar(() => {
      const email = document.querySelector('[name="profileEmail"]')?.value.trim().toLowerCase() || activeClientKey;
      const clientName = document.querySelector('[name="profileClientName"]')?.value.trim() || noDataText;
      const petNamesText = document.querySelector('[name="profilePetNames"]')?.value.trim() || noDataText;
      const portalStatus = document.querySelector('[name="profilePortalStatus"]')?.value.trim() || noDataText;

      saveAdminState(
        {
          clientName,
          petNames: petNamesText === noDataText
            ? [noDataText]
            : petNamesText.split(",").map((pet) => pet.trim()).filter(Boolean),
          portalStatus,
          clientStage: document.querySelector('[name="profileClientStage"]')?.value.trim() || "active",
          profile: {
            email,
            clientName,
            petNames: petNamesText,
            phone: document.querySelector('[name="profilePhone"]')?.value.trim() || noDataText,
            area: document.querySelector('[name="profileArea"]')?.value.trim() || noDataText,
            emergencyContact: document.querySelector('[name="profileEmergencyContact"]')?.value.trim() || noDataText,
            feedingRoutine: document.querySelector('[name="profileFeedingRoutine"]')?.value.trim() || noDataText,
            medicationSummary: document.querySelector('[name="profileMedicationSummary"]')?.value.trim() || noDataText,
            pottyWalkRoutine: document.querySelector('[name="profilePottyWalkRoutine"]')?.value.trim() || noDataText,
            behaviorNotes: document.querySelector('[name="profileBehaviorNotes"]')?.value.trim() || noDataText,
            householdNotes: document.querySelector('[name="profileHouseholdNotes"]')?.value.trim() || noDataText,
            portalStatus,
            clientStage: document.querySelector('[name="profileClientStage"]')?.value.trim() || "active"
          }
        },
        {
          syncToSheets: true,
          successMessage: "Client updated successfully",
          failureMessage: "Failed to update client"
        }
      );
    });

    if (cards[0]) {
      cards[0].innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Client Details";
      const grid = buildAdminFormGrid([
        { label: "Email", name: "profileEmail", value: activeClientData.profile.email === noDataText ? activeClientKey : activeClientData.profile.email, type: "email" },
        { label: "Client name", name: "profileClientName", value: activeClientData.profile.clientName || activeClientData.clientName },
        { label: "Pet names", name: "profilePetNames", value: activeClientData.profile.petNames || activeClientData.petNames.join(", ") }
      ]);
      cards[0].append(title, grid);
    }

    if (cards[1]) {
      cards[1].innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Contact";
      const grid = buildAdminFormGrid([
        { label: "Phone", name: "profilePhone", value: activeClientData.profile.phone },
        { label: "Area", name: "profileArea", value: activeClientData.profile.area },
        { label: "Emergency contact", name: "profileEmergencyContact", value: activeClientData.profile.emergencyContact }
      ]);
      cards[1].append(title, grid);
    }

    if (cards[2]) {
      cards[2].innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Daily Care";
      const grid = buildAdminFormGrid([
        { label: "Feeding routine", name: "profileFeedingRoutine", value: activeClientData.profile.feedingRoutine, multiline: true },
        { label: "Potty or walk routine", name: "profilePottyWalkRoutine", value: activeClientData.profile.pottyWalkRoutine, multiline: true }
      ]);
      cards[2].append(title, grid);
    }

    if (cards[3]) {
      cards[3].innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Medication and Behavior";
      const grid = buildAdminFormGrid([
        { label: "Medication summary", name: "profileMedicationSummary", value: activeClientData.profile.medicationSummary, multiline: true },
        { label: "Behavior notes", name: "profileBehaviorNotes", value: activeClientData.profile.behaviorNotes, multiline: true }
      ]);
      cards[3].append(title, grid);
    }

    if (cards[4]) {
      cards[4].innerHTML = "";
      const title = document.createElement("h3");
      title.textContent = "Household";
      const grid = buildAdminFormGrid([
        { label: "Household notes", name: "profileHouseholdNotes", value: activeClientData.profile.householdNotes, multiline: true },
        {
          label: "Client stage",
          name: "profileClientStage",
          value: activeClientData.profile.clientStage || activeClientData.clientStage,
          type: "select",
          options: ["active", "upcoming", "completed", "archived", "not responding", "declined"]
        },
        {
          label: "Portal status",
          name: "profilePortalStatus",
          value: activeClientData.profile.portalStatus || activeClientData.portalStatus,
          type: "select",
          options: ["Active", "Inactive", "Paused", "Pending", noDataText]
        }
      ]);
      cards[4].append(title, grid);
    }
  };

  const renderAdminManagementView = () => {
    if (!isAdminView || !activeClientRecord) {
      const existingToolbar = document.querySelector(".admin-toolbar");
      if (existingToolbar) {
        existingToolbar.remove();
      }
      return;
    }

    if (currentPage === "dashboard.html") {
      renderDashboardAdminEditor();
    }

    if (currentPage === "updates.html") {
      renderUpdatesAdminEditor();
    }

    if (currentPage === "payments.html") {
      renderPaymentsAdminEditor();
    }

    if (currentPage === "profile.html") {
      renderProfileAdminEditor();
    }

    if (currentPage === "messages.html") {
      createAdminToolbar(null);
    }
  };

  const getCareSummary = () => {
    const summaries = [
      `Feeding: ${activeClientData.profile.feedingRoutine !== noDataText ? activeClientData.profile.feedingRoutine : activeClientData.careNotes.feeding}`,
      `Medication: ${activeClientData.profile.medicationSummary !== noDataText ? activeClientData.profile.medicationSummary : activeClientData.careNotes.medication}`,
      `Potty/Walk: ${activeClientData.profile.pottyWalkRoutine !== noDataText ? activeClientData.profile.pottyWalkRoutine : activeClientData.careNotes.walk}`,
      `Behavior: ${activeClientData.profile.behaviorNotes !== noDataText ? activeClientData.profile.behaviorNotes : activeClientData.careNotes.behavior}`
    ].filter((line) => !line.endsWith(noDataText));

    return summaries.length > 0 ? summaries.join("\n") : noCareText;
  };

  const getLatestUpdateSummary = () => {
    if (activeClientData.latestUpdate.title !== noDataText && activeClientData.latestUpdate.message !== noDataText) {
      return `${activeClientData.latestUpdate.title}: ${activeClientData.latestUpdate.message}`;
    }

    if (activeClientData.latestUpdate.message !== noDataText) {
      return activeClientData.latestUpdate.message;
    }

    if (activeClientData.latestUpdate.title !== noDataText) {
      return activeClientData.latestUpdate.title;
    }

    return noUpdateText;
  };

  const applyPortalPageContent = () => {
    pageRoleLabels.forEach((label) => {
      label.textContent = isAdminView ? "Admin Portal" : "Client Portal";
    });

    const pageTitles = getPageCopy();
    const config = pageTitles[currentPage];

    if (!config) {
      return;
    }

    const pageCopy = isAdminView ? config.admin : config.client;

    if (currentPage === "dashboard.html") {
      console.log("dashboard data source:", activeClientData);
      const stayDuration = getNightCount(activeClientData.stayDetails.startDate, activeClientData.stayDetails.endDate);
      const formattedNightlyRate = formatCurrencyDisplay(activeClientData.stayDetails.nightlyRate, { decimals: 0 });
      const formattedTotalAmount = formatCurrencyDisplay(
        activeClientData.stayDetails.totalAmount || activeClientData.paymentDetails.amount,
        { decimals: 2 }
      );
      const dashboardServiceType = activeClientData.stayDetails.serviceType || activeClientData.paymentDetails.service || noDataText;
      setText("#dashboard-title", pageCopy.title);
      setText("#dashboard-description", pageCopy.description);
      setText("#dashboard-client-name", activeClientData.clientName);
      setListText("#dashboard-pet-names", activeClientData.petNames);
      setText("#dashboard-hero-label-1", "Portal Status");
      setText("#dashboard-hero-value-1", activeClientData.portalStatus);
      setText("#dashboard-hero-label-2", "Client Stage");
      setText("#dashboard-hero-value-2", formatClientStage(activeClientData.clientStage));
      setText("#dashboard-card-1-title", "Client Overview");
      setText("#dashboard-card-1-badge", activeClientData.paymentStatus);
      setText("#dashboard-card-1-text", `Client: ${activeClientData.clientName}\nPets: ${activeClientData.petNames.join(", ")}\nPortal status: ${activeClientData.portalStatus}\nClient stage: ${formatClientStage(activeClientData.clientStage)}\nPayment status: ${activeClientData.paymentStatus}\nService type: ${dashboardServiceType}`);
      setText("#dashboard-card-2-title", "Stay Details");
      setText("#dashboard-card-2-badge", formattedTotalAmount || noDataText);
      setText("#dashboard-card-2-text", activeClientData.stayDetails.startDate || activeClientData.stayDetails.endDate || activeClientData.stayDetails.nightlyRate || activeClientData.stayDetails.totalAmount
        ? `Start date: ${activeClientData.stayDetails.startDate || noBookingText}\nEnd date: ${activeClientData.stayDetails.endDate || noBookingText}\nDuration: ${stayDuration ? `${stayDuration} days` : noBookingText}\nNightly rate: ${formattedNightlyRate || noBookingText}\nTotal amount: ${formattedTotalAmount || noBookingText}`
        : noBookingText);
      setText("#dashboard-card-3-title", "Latest Update Summary");
      setText("#dashboard-card-3-badge", activeClientData.latestUpdate.timestamp);
      setText("#dashboard-card-3-text", getLatestUpdateSummary());
      setText("#dashboard-update-media", activeClientData.latestUpdate.media === noDataText ? noUpdateText : activeClientData.latestUpdate.media);
      setText("#dashboard-update-time", activeClientData.latestUpdate.timestamp === noDataText ? noUpdateText : activeClientData.latestUpdate.timestamp);
      setText("#dashboard-card-4-title", "Quick Care Summary");
      setText("#dashboard-care-feeding", activeClientData.profile.feedingRoutine !== noDataText ? activeClientData.profile.feedingRoutine : noCareText);
      setText("#dashboard-care-medication", activeClientData.profile.medicationSummary !== noDataText ? activeClientData.profile.medicationSummary : noCareText);
      setText("#dashboard-care-walk", activeClientData.profile.pottyWalkRoutine !== noDataText ? activeClientData.profile.pottyWalkRoutine : noCareText);
      setText("#dashboard-care-behavior", activeClientData.profile.behaviorNotes !== noDataText ? activeClientData.profile.behaviorNotes : noCareText);
      setText("#dashboard-section-title", "Care Snapshot");
      setText("#dashboard-section-copy", "This page reflects the latest saved profile, payments, and update details.");
      setText("#dashboard-card-5-title", "Summary");
      setText("#dashboard-card-5-text", getCareSummary());
      activeClientData.checklist.forEach((item, index) => {
        const lines = [
          `Payment status: ${activeClientData.paymentStatus}`,
          `Service type: ${activeClientData.stayDetails.serviceType || noBookingText}`,
          `Start date: ${activeClientData.stayDetails.startDate || noBookingText}`,
          `End date: ${activeClientData.stayDetails.endDate || noBookingText}`,
          `Nightly rate: ${activeClientData.stayDetails.nightlyRate || noBookingText}`,
          `Total amount: ${activeClientData.stayDetails.totalAmount || activeClientData.paymentDetails.amount || noBookingText}`
        ];
        setText(`#dashboard-checklist-${index + 1}`, lines[index] || noBookingText);
      });
    }

    if (currentPage === "updates.html") {
      console.log("updates data source:", activeClientData.latestUpdate);
      setText("#updates-title", pageCopy.title);
      setText("#updates-description", pageCopy.description);
      setText("#updates-banner-copy", activeClientData.latestUpdate.message === noDataText ? noUpdateText : "Update details below are the latest saved notes for this client.");
      setText("#updates-card-1-title", activeClientData.latestUpdate.title === noDataText
        ? `${activeClientData.clientName}'s Latest Update`
        : activeClientData.latestUpdate.title);
      setText("#updates-card-1-text", activeClientData.latestUpdate.message === noDataText ? noUpdateText : activeClientData.latestUpdate.message);
      setText("#updates-card-2-title", "Media and Timestamp");
      setText("#updates-card-2-text", activeClientData.latestUpdate.media !== noDataText || activeClientData.latestUpdate.timestamp !== noDataText
        ? `Media: ${activeClientData.latestUpdate.media}\nTimestamp: ${activeClientData.latestUpdate.timestamp}`
        : noUpdateText);
      setText("#updates-empty-title", `Updates for ${activeClientData.clientName}`);
      setText("#updates-empty-text", activeClientData.latestUpdate.message === noDataText ? noUpdateText : "Use this page to keep visit updates current.");
    }

    if (currentPage === "messages.html") {
      setText("#messages-subtitle", isAdminView ? config.admin.subtitle : config.client.subtitle);
      setText("#messages-banner-copy", isAdminView ? config.admin.banner : config.client.banner);
    }

    if (currentPage === "payments.html") {
      console.log("payments data source:", {
        paymentDetails: activeClientData.paymentDetails,
        stayDetails: activeClientData.stayDetails
      });
      const formattedPaymentAmount = formatCurrencyDisplay(
        activeClientData.paymentDetails.amount || activeClientData.stayDetails.totalAmount,
        { decimals: 2 }
      );
      const formattedPaymentNightlyRate = formatCurrencyDisplay(activeClientData.stayDetails.nightlyRate, { decimals: 0 });
      setText("#payments-title", pageCopy.title);
      setText("#payments-description", pageCopy.description);
      setText("#payments-banner-copy", activeClientData.paymentDetails.amount !== noDataText || activeClientData.stayDetails.serviceType !== noDataText
        ? `Service: ${activeClientData.stayDetails.serviceType || noPaymentText}\nStay: ${activeClientData.stayDetails.startDate || noBookingText} to ${activeClientData.stayDetails.endDate || noBookingText}`
        : noPaymentText);
      setText("#payments-card-1-title", isAdminView ? "Open Items" : "Payment Status");
      setText("#payments-card-1-text", activeClientData.paymentDetails.amount !== noDataText || activeClientData.paymentDetails.status !== noDataText
        ? `Service: ${activeClientData.paymentDetails.service}\nAmount: ${formattedPaymentAmount || noPaymentText}\nStatus: ${activeClientData.paymentDetails.status}`
        : noPaymentText);
      setText("#payments-card-2-title", isAdminView ? "Billing Overview" : "Billing History");
      setText("#payments-card-2-text", activeClientData.stayDetails.startDate || activeClientData.stayDetails.endDate || activeClientData.stayDetails.nightlyRate || activeClientData.paymentDetails.notes !== noDataText
        ? `Start: ${activeClientData.stayDetails.startDate || noBookingText}\nEnd: ${activeClientData.stayDetails.endDate || noBookingText}\nNightly rate: ${formattedPaymentNightlyRate || noBookingText}\nDue: ${activeClientData.paymentDetails.dueDate}\nPaid: ${activeClientData.paymentDetails.paidDate}\nNotes: ${activeClientData.paymentDetails.notes}`
        : noPaymentText);
      setText("#payments-empty-title", `${activeClientData.clientName}'s payment record`);
      setText("#payments-empty-text", activeClientData.paymentDetails.amount === noDataText ? noPaymentText : "Payment details saved here will also update the dashboard summary.");
    }

    if (currentPage === "profile.html") {
      console.log("profile data source:", activeClientData.profile);
      setText("#profile-title", pageCopy.title);
      setText("#profile-description", pageCopy.description);
      setText("#profile-banner-copy", activeClientData.profile.clientName === noDataText ? noProfileText : "Client profile details saved here power the rest of the admin summary.");
      setText("#profile-card-1-title", isAdminView ? "Client Name" : "Client Details");
      setText("#profile-card-1-text", isAdminView
        ? activeClientData.profile.clientName
        : `Client name: ${activeClientData.profile.clientName}\nEmail: ${activeClientData.profile.email}\nPhone: ${activeClientData.profile.phone}\nArea: ${activeClientData.profile.area}`);
      setText("#profile-card-2-title", isAdminView ? "Pet Names" : "Pets and Contact");
      setText("#profile-card-2-text", isAdminView
        ? activeClientData.profile.petNames
        : `Pet names: ${activeClientData.profile.petNames}\nEmergency contact: ${activeClientData.profile.emergencyContact}`);
      setText("#profile-card-3-title", isAdminView ? "Care Notes" : "Care Notes");
      setText("#profile-card-3-text", isAdminView
        ? activeClientData.profile.feedingRoutine
        : activeClientData.profile.feedingRoutine === noDataText ? noCareText : `${activeClientData.profile.feedingRoutine}\nPotty/Walk: ${activeClientData.profile.pottyWalkRoutine}`);
      setText("#profile-card-4-title", isAdminView ? "Routine Notes" : "Medication and Behavior");
      setText("#profile-card-4-text", isAdminView
        ? activeClientData.profile.medicationSummary
        : activeClientData.profile.medicationSummary === noDataText ? noCareText : `${activeClientData.profile.medicationSummary}\nBehavior: ${activeClientData.profile.behaviorNotes}`);
      setText("#profile-card-5-title", isAdminView ? "Household Notes" : "Household and Portal");
      setText("#profile-card-5-text", isAdminView
        ? activeClientData.profile.householdNotes
        : activeClientData.profile.householdNotes === noDataText
          ? noProfileText
          : `Household notes: ${activeClientData.profile.householdNotes}\nPortal status: ${activeClientData.profile.portalStatus}\nClient stage: ${formatClientStage(activeClientData.profile.clientStage)}`);
    }

    renderAdminManagementView();
  };

  updateMessagesNavBadge();
  applyPortalPageContent();

  try {
    const firebaseAuth = await initializeFirebaseAuth();

    firebaseAuth.onAuthStateChanged(firebaseAuth.auth, async (user) => {
      if (!user) {
        clearAuthSession();
        updateNavigationVisibility(false);

        if (protectedPages.includes(currentPage)) {
          window.location.href = "index.html";
        }

        return;
      }

      const portalAccess = await resolvePortalAccess(user);

      if (!portalAccess.ok) {
        await firebaseAuth.signOut(firebaseAuth.auth);
        updateNavigationVisibility(false);

        if (currentPage === "index.html") {
          setAuthStatus(portalAccess.message);
        }

        return;
      }

      updateNavigationVisibility(true);

      if (currentPage === "index.html") {
        window.location.href = "dashboard.html";
      }
    });
  } catch (error) {
    console.error("Firebase initialization error:", error);
    setAuthStatus("Firebase could not be initialized. Please check your project settings.");
  }

  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.logoutUser();
    });
  });

  if (chatThread && chatForm) {
    const chatInput = document.querySelector("#chat-input");
    const chatUpload = document.querySelector("#chat-upload");
    const uploadButton = document.querySelector(".upload-button");
    const fileStatus = document.querySelector("#file-status");
    const clientSidebar = document.querySelector("#client-sidebar");
    const chatClientName = document.querySelector("#chat-client-name");
    const chatModeBadge = document.querySelector("#chat-mode-badge");
    const messagesLayout = document.querySelector(".messages-layout");
    const chatContext = document.querySelector("#chat-context");

    const availableClients = isAdminView
      ? adminClients
      : activeClientRecord?.name
        ? [activeClientRecord.name]
        : [];
    let selectedClient = isAdminView
      ? resolveSelectedClientName(portalUsers, localStorage.getItem("jjcareSelectedClient") || defaultAdminClient)
      : activeClientRecord?.name || "";
    let highlightedMessageId = null;

    const canUploadMedia = isAdminView;
    const senderConfig = isAdminView
      ? { sender: "jjcare", label: "JJ Care" }
      : { sender: "client", label: "Client" };
    const incomingSender = isAdminView ? "client" : "jjcare";

    const getStorageKey = (clientName) => `messages_${clientName}`;

    const buildClientButtons = () => {
      if (!clientSidebar) {
        return [];
      }

      clientSidebar.innerHTML = "";

      if (!isAdminView) {
        return [];
      }

      if (adminClients.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "chat-empty-state";
        emptyState.textContent = noDataText;
        clientSidebar.appendChild(emptyState);
        return [];
      }

      return adminClients.map((clientName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "client-item";
        button.dataset.client = clientName;

        const nameSpan = document.createElement("span");
        nameSpan.textContent = clientName;

        const badge = document.createElement("span");
        badge.className = "unread-badge";
        badge.dataset.unreadFor = clientName;
        badge.hidden = true;
        badge.textContent = "0";

        button.append(nameSpan, badge);
        clientSidebar.appendChild(button);
        return button;
      });
    };

    let clientButtons = buildClientButtons();

    const createMessageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const scrollChatToBottom = () => {
      requestAnimationFrame(() => {
        chatThread.scrollTop = chatThread.scrollHeight;
      });
    };

    const getMessages = (clientName) => {
      const storageKey = getStorageKey(clientName);
      const savedMessages = readJsonStorage(storageKey, null);

      if (Array.isArray(savedMessages)) {
        return savedMessages;
      }

      localStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    };

    const setUnreadCount = (clientName, count) => {
      const unreadCounts = getUnreadCounts();
      unreadCounts[clientName] = count;
      setUnreadCounts(unreadCounts);
    };

    const clearUnreadCount = (clientName) => {
      setUnreadCount(clientName, 0);
    };

    const incrementUnreadCount = (clientName) => {
      const unreadCounts = getUnreadCounts();
      unreadCounts[clientName] = Number(unreadCounts[clientName] || 0) + 1;
      setUnreadCounts(unreadCounts);
    };

    const syncUnreadFromMessages = () => {
      const unreadCounts = getUnreadCounts();

      availableClients.forEach((clientName) => {
        const messages = getMessages(clientName);
        const incomingCount = messages.filter((message) => message.sender === incomingSender).length;

        if (typeof unreadCounts[clientName] !== "number") {
          unreadCounts[clientName] = clientName === selectedClient ? 0 : incomingCount;
        }
      });

      unreadCounts[selectedClient] = 0;
      setUnreadCounts(unreadCounts);
    };

    const renderUnreadBadges = () => {
      const unreadCounts = getUnreadCounts();

      clientButtons.forEach((button) => {
        const badge = button.querySelector(".unread-badge");
        const clientName = button.dataset.client;
        const unreadCount = Number(unreadCounts[clientName] || 0);

        if (badge) {
          badge.textContent = unreadCount;
          badge.hidden = unreadCount === 0;
        }
      });

      updateMessagesNavBadge();
    };

    if (chatModeBadge) {
      chatModeBadge.textContent = isAdminView ? "Admin Portal" : "Client Portal";
    }

    if (uploadButton) {
      uploadButton.hidden = !canUploadMedia;
    }

    if (chatUpload) {
      chatUpload.hidden = !canUploadMedia;
    }

    if (fileStatus) {
      fileStatus.textContent = canUploadMedia ? "No file selected" : "";
    }

    if (clientSidebar) {
      clientSidebar.hidden = !isAdminView;
    }

    if (messagesLayout) {
      messagesLayout.classList.toggle("client-mode", !isAdminView);
    }

    if (chatContext) {
      chatContext.textContent = isAdminView
        ? "All client conversations"
        : "Private conversation";
    }

    if (chatInput) {
      chatInput.placeholder = isAdminView
        ? "Send an update to the client..."
        : "Reply to JJ Care...";
    }

    const renderMessages = (options = {}) => {
      const { scrollToLatest = false } = options;

      if (availableClients.length === 0) {
        chatThread.innerHTML = "<p class=\"chat-empty-state\">No messages yet</p>";
        if (chatClientName) {
          chatClientName.textContent = noDataText;
        }
        renderUnreadBadges();
        return;
      }

      const messages = getMessages(selectedClient);
      chatThread.innerHTML = "";

      if (chatClientName) {
        chatClientName.textContent = selectedClient;
      }

      messages.forEach((message) => {
        const item = document.createElement("div");
        item.className = `chat-message ${message.sender}`;

        if (message.id && message.id === highlightedMessageId) {
          item.classList.add("is-new");
        }

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble";

        const sender = document.createElement("p");
        sender.className = "chat-sender";
        sender.textContent = message.label;
        bubble.appendChild(sender);

        if (message.type === "image") {
          const image = document.createElement("img");
          image.className = "chat-media";
          image.src = message.data;
          image.alt = message.fileName || "Uploaded image";
          bubble.appendChild(image);
        } else if (message.type === "video") {
          const video = document.createElement("video");
          video.className = "chat-media chat-video";
          video.src = message.data;
          video.controls = true;
          bubble.appendChild(video);
        } else {
          const text = document.createElement("p");
          text.className = "chat-text";
          text.textContent = message.text;
          bubble.appendChild(text);
        }

        item.appendChild(bubble);
        chatThread.appendChild(item);
      });

      if (messages.length === 0) {
        chatThread.innerHTML = "<p class=\"chat-empty-state\">No messages yet</p>";
      }

      clientButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.client === selectedClient);
      });

      renderUnreadBadges();

      if (scrollToLatest) {
        scrollChatToBottom();
      }

      highlightedMessageId = null;
    };

    if (!availableClients.includes(selectedClient)) {
      selectedClient = availableClients[0] || "";
      if (isAdminView) {
        localStorage.setItem("jjcareSelectedClient", selectedClient);
      }
    }

    syncUnreadFromMessages();
    renderMessages({ scrollToLatest: true });

    if (isAdminView) {
      clientButtons.forEach((button) => {
        button.addEventListener("click", () => {
          selectedClient = button.dataset.client;
          localStorage.setItem("jjcareSelectedClient", selectedClient);
          clearUnreadCount(selectedClient);
          renderMessages({ scrollToLatest: true });
        });
      });
    }

    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (availableClients.length === 0) {
        return;
      }

      const text = chatInput.value.trim();

      if (!text) {
        return;
      }

      const messages = getMessages(selectedClient);
      const newMessage = {
        id: createMessageId(),
        type: "text",
        sender: senderConfig.sender,
        label: senderConfig.label,
        text
      };

      messages.push(newMessage);
      localStorage.setItem(getStorageKey(selectedClient), JSON.stringify(messages));

      if (senderConfig.sender === incomingSender) {
        incrementUnreadCount(selectedClient);
      } else {
        clearUnreadCount(selectedClient);
      }

      highlightedMessageId = newMessage.id;
      renderMessages({ scrollToLatest: true });
      showToast(senderConfig.sender === "jjcare" ? "New update sent" : "New message");
      chatInput.value = "";
      chatInput.focus();
    });

    if (chatUpload) {
      chatUpload.addEventListener("change", () => {
        if (!canUploadMedia || availableClients.length === 0) {
          chatUpload.value = "";
          return;
        }

        const [file] = chatUpload.files || [];

        if (!file) {
          if (fileStatus) {
            fileStatus.textContent = "No file selected";
          }
          return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "video/mp4"];

        if (!allowedTypes.includes(file.type)) {
          if (fileStatus) {
            fileStatus.textContent = "Unsupported file type";
          }
          chatUpload.value = "";
          return;
        }

        if (fileStatus) {
          fileStatus.textContent = file.name;
        }

        const reader = new FileReader();

        reader.addEventListener("load", () => {
          const messages = getMessages(selectedClient);
          const isVideo = file.type === "video/mp4";
          const newMessage = {
            id: createMessageId(),
            type: isVideo ? "video" : "image",
            sender: senderConfig.sender,
            label: senderConfig.label,
            data: reader.result,
            fileName: file.name
          };

          messages.push(newMessage);
          localStorage.setItem(getStorageKey(selectedClient), JSON.stringify(messages));

          if (senderConfig.sender === incomingSender) {
            incrementUnreadCount(selectedClient);
          } else {
            clearUnreadCount(selectedClient);
          }

          highlightedMessageId = newMessage.id;
          renderMessages({ scrollToLatest: true });
          showToast(senderConfig.sender === "jjcare" ? "New update sent" : "New message");
          chatUpload.value = "";

          if (fileStatus) {
            fileStatus.textContent = "No file selected";
          }
        });

        reader.readAsDataURL(file);
      });
    }
  }

  if (authFootnote && currentPage === "index.html") {
    authFootnote.textContent = "Sign in with Google to access your JJ Care portal.";
  }
});
