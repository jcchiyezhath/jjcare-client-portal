var CLIENT_SHEET_NAME = "Clients";
var CLIENT_SHEET_COLUMNS = [
  "clientId",
  "email",
  "name",
  "pets",
  "role",
  "clientStage",
  "portalStatus",
  "phone",
  "area",
  "emergencyContact",
  "feedingRoutine",
  "medicationSummary",
  "pottyOrWalkRoutine",
  "behaviorNotes",
  "householdNotes",
  "startDate",
  "endDate",
  "nightlyRate",
  "totalAmount",
  "serviceType"
];

function doPost(e) {
  try {
    var payload = getPayload_(e);
    var action = String(payload.action || "add").trim().toLowerCase();
    var clientId = String(payload.clientId || "").trim();

    Logger.log("action received: " + action);
    Logger.log("clientId received: " + (clientId || "(missing)"));

    if (action === "update") {
      return handleUpdate_(payload, clientId);
    }

    return handleAdd_(payload, clientId);
  } catch (error) {
    Logger.log("request failure: " + error);
    return jsonResponse_({
      ok: false,
      message: "Failed to update client",
      error: String(error)
    });
  }
}

function handleAdd_(payload, clientId) {
  Logger.log("path used: add");

  var sheet = getClientSheet_();
  var nextClientId = clientId || generateSequentialClientId_(sheet);
  var rowValues = buildClientRowValues_(payload, nextClientId);

  Logger.log("generated clientId: " + nextClientId);
  Logger.log("final add payload: " + JSON.stringify(buildOrderedAddPayload_(payload, nextClientId)));
  Logger.log("ordered values array being sent/saved: " + JSON.stringify(rowValues));

  sheet.appendRow(rowValues);

  Logger.log("add success for clientId: " + nextClientId);
  Logger.log("add success result: " + JSON.stringify({
    ok: true,
    message: "Client added successfully",
    action: "add",
    clientId: nextClientId
  }));

  return jsonResponse_({
    ok: true,
    message: "Client added successfully",
    action: "add",
    clientId: nextClientId
  });
}

function handleUpdate_(payload, clientId) {
  Logger.log("path used: update");

  var sheet = getClientSheet_();
  var matchedRow = findClientRow_(sheet, clientId, String(payload.originalEmail || payload.email || "").trim().toLowerCase());
  var nextClientId = clientId;

  if (!matchedRow && !clientId && payload.email) {
    matchedRow = findClientRowByEmail_(sheet, String(payload.email || "").trim().toLowerCase());
  }

  if (!matchedRow) {
    Logger.log("matched row number: not found");
    Logger.log("update failure: no matching client row");

    return jsonResponse_({
      ok: false,
      message: "Failed to update client",
      action: "update",
      clientId: clientId || ""
    });
  }

  if (!nextClientId) {
    nextClientId = String(sheet.getRange(matchedRow, 1).getValue() || "").trim() || generateClientId_();
  }

  Logger.log("matched row number: " + matchedRow);

  sheet.getRange(matchedRow, 1, 1, CLIENT_SHEET_COLUMNS.length).setValues([
    buildClientRowValues_(payload, nextClientId)
  ]);

  Logger.log("update success for clientId: " + nextClientId);

  return jsonResponse_({
    ok: true,
    message: "Client updated successfully",
    action: "update",
    clientId: nextClientId,
    rowNumber: matchedRow
  });
}

function getClientSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENT_SHEET_NAME);

  if (!sheet) {
    throw new Error("Missing sheet: " + CLIENT_SHEET_NAME);
  }

  return sheet;
}

function getPayload_(e) {
  if (!e || !e.parameter) {
    return {};
  }

  return e.parameter;
}

function buildClientRowValues_(payload, clientId) {
  return [
    String(clientId || "").trim(),
    String(payload.email || "").trim().toLowerCase(),
    String(payload.name || "").trim(),
    String(payload.pets || "").trim(),
    String(payload.role || "client").trim().toLowerCase(),
    String(payload.clientStage || "").trim(),
    String(payload.portalStatus || "").trim(),
    String(payload.phone || "").trim(),
    String(payload.area || "").trim(),
    String(payload.emergencyContact || "").trim(),
    String(payload.feedingRoutine || "").trim(),
    String(payload.medicationSummary || "").trim(),
    String(payload.pottyOrWalkRoutine || "").trim(),
    String(payload.behaviorNotes || "").trim(),
    String(payload.householdNotes || "").trim(),
    String(payload.startDate || "").trim(),
    String(payload.endDate || "").trim(),
    String(payload.nightlyRate || "").trim(),
    String(payload.totalAmount || "").trim(),
    String(payload.serviceType || "").trim()
  ];
}

function buildOrderedAddPayload_(payload, clientId) {
  return {
    clientId: String(clientId || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    name: String(payload.name || "").trim(),
    pets: String(payload.pets || "").trim(),
    role: String(payload.role || "client").trim().toLowerCase(),
    clientStage: String(payload.clientStage || "").trim(),
    portalStatus: String(payload.portalStatus || "").trim(),
    phone: String(payload.phone || "").trim(),
    area: String(payload.area || "").trim(),
    emergencyContact: String(payload.emergencyContact || "").trim(),
    feedingRoutine: String(payload.feedingRoutine || "").trim(),
    medicationSummary: String(payload.medicationSummary || "").trim(),
    pottyOrWalkRoutine: String(payload.pottyOrWalkRoutine || "").trim(),
    behaviorNotes: String(payload.behaviorNotes || "").trim(),
    householdNotes: String(payload.householdNotes || "").trim(),
    startDate: String(payload.startDate || "").trim(),
    endDate: String(payload.endDate || "").trim(),
    nightlyRate: String(payload.nightlyRate || "").trim(),
    totalAmount: String(payload.totalAmount || "").trim(),
    serviceType: String(payload.serviceType || "").trim()
  };
}

function findClientRow_(sheet, clientId, fallbackEmail) {
  var normalizedClientId = String(clientId || "").trim();

  if (normalizedClientId) {
    var matchedById = findClientRowByClientId_(sheet, normalizedClientId);

    if (matchedById) {
      return matchedById;
    }
  }

  if (fallbackEmail) {
    return findClientRowByEmail_(sheet, fallbackEmail);
  }

  return 0;
}

function findClientRowByClientId_(sheet, clientId) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "").trim() === clientId) {
      return index + 2;
    }
  }

  return 0;
}

function findClientRowByEmail_(sheet, email) {
  var normalizedEmail = String(email || "").trim().toLowerCase();
  var lastRow = sheet.getLastRow();

  if (!normalizedEmail || lastRow < 2) {
    return 0;
  }

  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "").trim().toLowerCase() === normalizedEmail) {
      return index + 2;
    }
  }

  return 0;
}

function generateClientId_() {
  return "client_" + new Date().getTime() + "_" + Utilities.getUuid().slice(0, 8);
}

function generateSequentialClientId_(sheet) {
  var lastRow = sheet.getLastRow();
  var highestClientNumber = 1000;

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (var index = 0; index < values.length; index += 1) {
      var clientId = String(values[index][0] || "").trim();
      var match = clientId.match(/^CL-(\d+)$/i);

      if (!match) {
        continue;
      }

      var parsedValue = parseInt(match[1], 10);

      if (!isNaN(parsedValue) && parsedValue > highestClientNumber) {
        highestClientNumber = parsedValue;
      }
    }
  }

  return "CL-" + (highestClientNumber + 1);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
