const campaignForm = document.querySelector("#campaign-form");
const recipientForm = document.querySelector("#recipient-form");
const quickRecipientForm = document.querySelector("#quick-recipient-form");
const amazonForm = document.querySelector("#amazon-form");
const emailForm = document.querySelector("#email-form");
const executionForm = document.querySelector("#execution-form");

const campaignNameInput = document.querySelector("#campaign-name");
const campaignGoalInput = document.querySelector("#campaign-goal");
const campaignOwnerInput = document.querySelector("#campaign-owner");
const campaignStartDateInput = document.querySelector("#campaign-start-date");
const targetFilterInput = document.querySelector("#target-filter");
const manualRecipientsInput = document.querySelector("#manual-recipients");
const quickNameInput = document.querySelector("#quick-name");
const quickEmailInput = document.querySelector("#quick-email");
const quickCompanyInput = document.querySelector("#quick-company");
const quickStreetInput = document.querySelector("#quick-street");
const quickCityInput = document.querySelector("#quick-city");
const quickStateInput = document.querySelector("#quick-state");
const quickZipInput = document.querySelector("#quick-zip");
const quickAssignedToInput = document.querySelector("#quick-assigned-to");
const quickAssignmentNoteInput = document.querySelector("#quick-assignment-note");
const amazonModeInput = document.querySelector("#amazon-mode");
const amazonRegionInput = document.querySelector("#amazon-region");
const amazonMarketplaceInput = document.querySelector("#amazon-marketplace");
const amazonClientIdInput = document.querySelector("#amazon-client-id");
const amazonRefreshTokenInput = document.querySelector("#amazon-refresh-token");
const amazonEndpointInput = document.querySelector("#amazon-endpoint");
const emailEnabledInput = document.querySelector("#email-enabled");
const emailTriggerInput = document.querySelector("#email-trigger");
const emailHostInput = document.querySelector("#email-host");
const emailPortInput = document.querySelector("#email-port");
const emailFromInput = document.querySelector("#email-from");
const emailUsernameInput = document.querySelector("#email-username");
const emailPasswordInput = document.querySelector("#email-password");
const emailSubjectSentInput = document.querySelector("#email-subject-sent");
const emailBodySentInput = document.querySelector("#email-body-sent");
const emailSubjectDeliveredInput = document.querySelector("#email-subject-delivered");
const emailBodyDeliveredInput = document.querySelector("#email-body-delivered");
const shippingDefaultsInput = document.querySelector("#shipping-defaults");
const runDateInput = document.querySelector("#run-date");

const campaignStatus = document.querySelector("#campaign-status");
const recipientStatus = document.querySelector("#recipient-status");
const recipientWarning = document.querySelector("#recipient-warning");
const amazonStatus = document.querySelector("#amazon-status");
const emailStatus = document.querySelector("#email-status");
const executionStatus = document.querySelector("#execution-status");
const queueOutput = document.querySelector("#queue-output");
const stepsList = document.querySelector("#steps-list");
const recipientList = document.querySelector("#recipient-list");
const orderHistory = document.querySelector("#order-history");
const stepTemplate = document.querySelector("#step-template");

const addStepButton = document.querySelector("#add-step");
const loadSavedButton = document.querySelector("#load-saved");
const seedThreeStepButton = document.querySelector("#seed-three-step");
const sendDueGiftsButton = document.querySelector("#send-due-gifts");
const copyJsonButton = document.querySelector("#copy-json");

const ORDER_STATUSES = [
  "draft_due",
  "due_needs_config",
  "ready_for_amazon_submission",
  "submitted_stub",
  "manually_ordered",
  "delivered",
  "canceled",
];

let appState = seedState();

hydrate();

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncCampaignFields();
  renderQueuePreview();
  await saveState("Campaign saved locally.");
});

recipientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const parsedRecipients = parseManualRecipients(manualRecipientsInput.value);
  const mergeResult = mergeRecipients(appState.recipients, parsedRecipients, appState.orderHistory);
  appState.recipients = mergeResult.recipients;
  renderRecipients();
  renderQueuePreview();
  recipientStatus.textContent = `${mergeResult.addedCount} contacts added from paste.`;
  recipientWarning.textContent = buildEnrollmentWarning(mergeResult.warnings);
  await saveState("Recipients saved locally.");
});

quickRecipientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const recipient = normalizeRecipient({
    id: crypto.randomUUID(),
    source: "manual",
    name: quickNameInput.value.trim(),
    email: quickEmailInput.value.trim(),
    company: quickCompanyInput.value.trim(),
    street: quickStreetInput.value.trim(),
    city: quickCityInput.value.trim(),
    state: quickStateInput.value.trim(),
    zip: quickZipInput.value.trim(),
    assignedTo: quickAssignedToInput.value.trim(),
    assignmentNote: quickAssignmentNoteInput.value.trim(),
  }, appState.orderHistory);

  if (!recipient.email) {
    recipientStatus.textContent = "An email is required to add a contact.";
    return;
  }

  const mergeResult = mergeRecipients(appState.recipients, [recipient], appState.orderHistory);
  appState.recipients = mergeResult.recipients;
  quickRecipientForm.reset();
  renderRecipients();
  renderQueuePreview();
  recipientStatus.textContent = `${recipient.name || recipient.email} added to the campaign.`;
  recipientWarning.textContent = buildEnrollmentWarning(mergeResult.warnings);
  await saveState("Recipients saved locally.");
});

amazonForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncAmazonFields();
  renderQueuePreview();
  await saveState("Amazon setup saved locally.");
  amazonStatus.textContent = amazonReady(appState)
    ? "Amazon setup looks complete enough for future API wiring."
    : "Amazon setup saved. Add the missing credentials later when you are ready.";
});

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncEmailFields();
  renderQueuePreview();
  await saveState("Email setup saved locally.");
  emailStatus.textContent = emailReady(appState)
    ? "Email automation is configured and ready to fire on the chosen trigger."
    : "Email setup saved. Fill in the missing SMTP fields before enabling automation.";
});

executionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncCampaignFields();
  syncAmazonFields();
  syncEmailFields();
  syncStepsFromDom();
  renderQueuePreview();
  executionStatus.textContent = "Purchase queue rebuilt.";
  await saveState("Execution settings saved locally.");
});

addStepButton.addEventListener("click", () => {
  syncStepsFromDom();
  appState.steps.push(blankStep(appState.steps));
  renderSteps();
  renderQueuePreview();
});

seedThreeStepButton.addEventListener("click", async () => {
  appState.steps = seedThreeStepSequence();
  renderSteps();
  renderQueuePreview();
  campaignStatus.textContent = "Seeded a 3-step sequence you can edit.";
  await saveState("Seeded a 3-step sequence.");
});

loadSavedButton.addEventListener("click", async () => {
  await loadState();
});

sendDueGiftsButton.addEventListener("click", async () => {
  syncCampaignFields();
  syncAmazonFields();
  syncEmailFields();
  syncStepsFromDom();

  try {
    const response = await fetch("/api/orders/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: appState,
        runDate: runDateInput.value || todayIso(),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to process due gifts.");
    }

    appState = normalizeState(payload.state);
    applyStateToForm();
    renderSteps();
    renderRecipients();
    renderOrderHistory();
    renderQueuePreview();
    executionStatus.textContent = `Processed ${payload.summary.processedCount} due gifts. ${payload.summary.createdCount} new order records created.`;
  } catch (error) {
    executionStatus.textContent = error.message;
  }
});

copyJsonButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(queueOutput.textContent);
    executionStatus.textContent = "Queue JSON copied.";
  } catch {
    executionStatus.textContent = "Copy failed in this browser.";
  }
});

function hydrate() {
  applyStateToForm();
  renderSteps();
  renderRecipients();
  renderOrderHistory();
  renderQueuePreview();
  void loadState(true);
}

async function loadState(silent = false) {
  try {
    const response = await fetch("/api/state");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to load saved data.");
    }

    if (payload.state) {
      appState = normalizeState(payload.state);
      applyStateToForm();
      renderSteps();
      renderRecipients();
      renderOrderHistory();
      renderQueuePreview();
      if (!silent) {
        campaignStatus.textContent = "Saved campaign reloaded.";
      }
    }
  } catch (error) {
    if (!silent) {
      campaignStatus.textContent = error.message;
    }
  }
}

async function saveState(message) {
  syncCampaignFields();
  syncAmazonFields();
  syncEmailFields();
  syncStepsFromDom();

  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appState }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to save data.");
    }

    appState = normalizeState(payload.state);
    renderOrderHistory();
    renderQueuePreview();
    campaignStatus.textContent = message;
  } catch (error) {
    campaignStatus.textContent = error.message;
  }
}

async function updateOrderStatus(orderId, status, note) {
  try {
    const response = await fetch("/api/orders/update_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: appState,
        orderId,
        status,
        note,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to update order status.");
    }

    appState = normalizeState(payload.state);
    renderOrderHistory();
    renderQueuePreview();
    executionStatus.textContent = "Order history updated.";
  } catch (error) {
    executionStatus.textContent = error.message;
  }
}

function syncCampaignFields() {
  appState.campaign.name = campaignNameInput.value.trim();
  appState.campaign.goal = campaignGoalInput.value.trim();
  appState.campaign.owner = campaignOwnerInput.value.trim();
  appState.campaign.startDate = campaignStartDateInput.value || todayIso();
  appState.campaign.targetFilter = targetFilterInput.value.trim();
}

function syncAmazonFields() {
  appState.execution.amazonMode = amazonModeInput.value;
  appState.execution.shippingDefaults = shippingDefaultsInput.value.trim();
  appState.amazon.region = amazonRegionInput.value.trim();
  appState.amazon.marketplace = amazonMarketplaceInput.value.trim();
  appState.amazon.clientId = amazonClientIdInput.value.trim();
  appState.amazon.refreshToken = amazonRefreshTokenInput.value.trim();
  appState.amazon.endpoint = amazonEndpointInput.value.trim();
}

function syncEmailFields() {
  appState.email.enabled = emailEnabledInput.value;
  appState.email.trigger = emailTriggerInput.value;
  appState.email.host = emailHostInput.value.trim();
  appState.email.port = Number(emailPortInput.value || 587);
  appState.email.fromAddress = emailFromInput.value.trim();
  appState.email.username = emailUsernameInput.value.trim();
  appState.email.password = emailPasswordInput.value.trim();
  appState.email.subjectWhenSent = emailSubjectSentInput.value.trim();
  appState.email.bodyWhenSent = emailBodySentInput.value.trim();
  appState.email.subjectWhenDelivered = emailSubjectDeliveredInput.value.trim();
  appState.email.bodyWhenDelivered = emailBodyDeliveredInput.value.trim();
}

function syncStepsFromDom() {
  const cards = Array.from(stepsList.querySelectorAll(".step-card"));
  appState.steps = cards.map((card, index) => ({
    id: card.dataset.stepId || crypto.randomUUID(),
    order: index + 1,
    name: card.querySelector(".step-name").value.trim() || `Step ${index + 1}`,
    delayDays: Number(card.querySelector(".step-delay").value || 0),
    itemName: card.querySelector(".step-item-name").value.trim(),
    asin: card.querySelector(".step-asin").value.trim(),
    itemUrl: card.querySelector(".step-url").value.trim(),
    quantity: Number(card.querySelector(".step-quantity").value || 1),
    message: card.querySelector(".step-message").value.trim(),
    emailSubjectWhenSent: card.querySelector(".step-email-subject-sent").value.trim(),
    emailBodyWhenSent: card.querySelector(".step-email-body-sent").value.trim(),
    emailSubjectWhenDelivered: card.querySelector(".step-email-subject-delivered").value.trim(),
    emailBodyWhenDelivered: card.querySelector(".step-email-body-delivered").value.trim(),
    note: card.querySelector(".step-note").value.trim(),
  }));
}

function applyStateToForm() {
  campaignNameInput.value = appState.campaign.name;
  campaignGoalInput.value = appState.campaign.goal;
  campaignOwnerInput.value = appState.campaign.owner;
  campaignStartDateInput.value = appState.campaign.startDate;
  targetFilterInput.value = appState.campaign.targetFilter;
  manualRecipientsInput.value = "";
  recipientWarning.textContent = "";
  amazonModeInput.value = appState.execution.amazonMode;
  shippingDefaultsInput.value = appState.execution.shippingDefaults;
  amazonRegionInput.value = appState.amazon.region;
  amazonMarketplaceInput.value = appState.amazon.marketplace;
  amazonClientIdInput.value = appState.amazon.clientId;
  amazonRefreshTokenInput.value = appState.amazon.refreshToken;
  amazonEndpointInput.value = appState.amazon.endpoint;
  emailEnabledInput.value = appState.email.enabled;
  emailTriggerInput.value = appState.email.trigger;
  emailHostInput.value = appState.email.host;
  emailPortInput.value = String(appState.email.port || 587);
  emailFromInput.value = appState.email.fromAddress;
  emailUsernameInput.value = appState.email.username;
  emailPasswordInput.value = appState.email.password;
  emailSubjectSentInput.value = appState.email.subjectWhenSent;
  emailBodySentInput.value = appState.email.bodyWhenSent;
  emailSubjectDeliveredInput.value = appState.email.subjectWhenDelivered;
  emailBodyDeliveredInput.value = appState.email.bodyWhenDelivered;
  runDateInput.value = todayIso();
}

function renderSteps() {
  stepsList.innerHTML = "";

  appState.steps.forEach((step, index) => {
    const fragment = stepTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".step-card");
    card.dataset.stepId = step.id;
    card.querySelector(".step-title").textContent = `Step ${index + 1}`;
    card.querySelector(".step-name").value = step.name;
    card.querySelector(".step-delay").value = String(step.delayDays ?? 0);
    card.querySelector(".step-item-name").value = step.itemName;
    card.querySelector(".step-asin").value = step.asin;
    card.querySelector(".step-url").value = step.itemUrl;
    card.querySelector(".step-quantity").value = String(step.quantity ?? 1);
    card.querySelector(".step-message").value = step.message;
    card.querySelector(".step-email-subject-sent").value = step.emailSubjectWhenSent || "";
    card.querySelector(".step-email-body-sent").value = step.emailBodyWhenSent || "";
    card.querySelector(".step-email-subject-delivered").value =
      step.emailSubjectWhenDelivered || "";
    card.querySelector(".step-email-body-delivered").value = step.emailBodyWhenDelivered || "";
    card.querySelector(".step-note").value = step.note;
    card.querySelector(".remove-step").addEventListener("click", () => {
      appState.steps = appState.steps.filter((entry) => entry.id !== step.id);
      renderSteps();
      renderQueuePreview();
      void saveState("Removed a send step.");
    });
    stepsList.appendChild(fragment);
  });

  if (!appState.steps.length) {
    appState.steps.push(blankStep([]));
    renderSteps();
  }
}

function renderRecipients() {
  recipientList.innerHTML = "";

  if (!appState.recipients.length) {
    recipientList.innerHTML = `<p class="helper-text">No recipients loaded yet.</p>`;
    return;
  }

  appState.recipients.forEach((recipient, index) => {
    const card = document.createElement("article");
    card.className = `recipient-card${recipient.hasPriorEnrollment ? " warning-card" : ""}`;
    card.innerHTML = `
      <div class="recipient-header">
        <h3 class="recipient-name">${escapeHtml(recipient.name || `Recipient ${index + 1}`)}</h3>
        <span class="recipient-badge">${escapeHtml(recipient.assignedTo || "Unassigned")}</span>
      </div>
      <p class="recipient-meta">${escapeHtml(recipient.email || "No email")}</p>
      <p class="recipient-meta">${escapeHtml(formatAddress(recipient))}</p>
      <p class="recipient-meta">${escapeHtml(recipient.company || "No company")}</p>
      ${recipient.hasPriorEnrollment ? `<p class="recipient-meta warning-text">Previously enrolled ${recipient.priorEnrollmentCount} time(s). Review before sending again.</p>` : ""}
      <div class="recipient-fields">
        <input class="recipient-assigned-to" type="text" placeholder="Assigned to" value="${escapeHtml(recipient.assignedTo || "")}" />
        <textarea class="recipient-assignment-note" rows="2" placeholder="Assignment note">${escapeHtml(recipient.assignmentNote || "")}</textarea>
      </div>
    `;

    card.querySelector(".recipient-assigned-to").addEventListener("input", async (event) => {
      recipient.assignedTo = event.target.value.trim();
      renderQueuePreview();
      await saveState("Recipient assignments saved locally.");
    });

    card.querySelector(".recipient-assignment-note").addEventListener("input", async (event) => {
      recipient.assignmentNote = event.target.value.trim();
      renderQueuePreview();
      await saveState("Recipient assignments saved locally.");
    });

    recipientList.appendChild(card);
  });
}

function renderOrderHistory() {
  orderHistory.innerHTML = "";

  if (!appState.orderHistory.length) {
    orderHistory.innerHTML = `<p class="helper-text">No orders have been processed yet.</p>`;
    return;
  }

  appState.orderHistory.forEach((order) => {
    const card = document.createElement("article");
    card.className = "recipient-card";
    card.innerHTML = `
      <div class="recipient-header">
        <h3 class="recipient-name">${escapeHtml(order.recipientName)} · ${escapeHtml(order.stepName)}</h3>
        <span class="status-pill">${escapeHtml(order.status)}</span>
      </div>
      <p class="recipient-meta">${escapeHtml(order.scheduledDate)} · ${escapeHtml(order.itemName)}</p>
      <p class="recipient-meta">${escapeHtml(order.assignedTo || "Unassigned")} · ${escapeHtml(order.externalId || "")}</p>
      <p class="recipient-meta">${escapeHtml(order.emailNotificationStatus || "email_not_scheduled")}</p>
      <div class="status-grid">
        <select class="order-status-select">
          ${ORDER_STATUSES.map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <textarea class="order-note" rows="2" placeholder="Order note">${escapeHtml(order.note || "")}</textarea>
      </div>
    `;

    const statusSelect = card.querySelector(".order-status-select");
    const noteInput = card.querySelector(".order-note");

    statusSelect.addEventListener("change", async (event) => {
      await updateOrderStatus(order.id, event.target.value, noteInput.value.trim());
    });

    noteInput.addEventListener("change", async (event) => {
      await updateOrderStatus(order.id, statusSelect.value, event.target.value.trim());
    });

    orderHistory.appendChild(card);
  });
}

function renderQueuePreview() {
  syncStepsFromDom();

  const runDate = runDateInput.value || todayIso();
  const queue = {
    campaign: appState.campaign,
    amazon: {
      mode: appState.execution.amazonMode,
      region: appState.amazon.region,
      marketplace: appState.amazon.marketplace,
      endpoint: appState.amazon.endpoint,
      credentialsReady: amazonReady(appState),
    },
    emailAutomation: {
      enabled: appState.email.enabled,
      trigger: appState.email.trigger,
      ready: emailReady(appState),
      fromAddress: appState.email.fromAddress,
    },
    runDate,
    recipients: appState.recipients.length,
    steps: appState.steps.length,
    dueToday: buildQueueOrders().filter((order) => order.isDueOnRunDate).length,
    orderHistory: appState.orderHistory.length,
    orders: buildQueueOrders(runDate),
  };

  queueOutput.textContent = JSON.stringify(queue, null, 2);
}

function buildQueueOrders(runDate = todayIso()) {
  return appState.recipients.flatMap((recipient) =>
    appState.steps.map((step) => {
      const scheduledDate = addDays(appState.campaign.startDate, step.delayDays);
      const orderKey = `${recipient.email}:${step.order}`;
      const existingOrder = appState.orderHistory.find((entry) => entry.orderKey === orderKey);
      const renderedMessage = fillTemplate(step.message, recipient, appState.campaign);
      const sentEmailSubject = fillTemplate(
        step.emailSubjectWhenSent || appState.email.subjectWhenSent,
        recipient,
        appState.campaign
      );
      const sentEmailBody = fillTemplate(
        step.emailBodyWhenSent || appState.email.bodyWhenSent,
        recipient,
        appState.campaign
      );
      const deliveredEmailSubject = fillTemplate(
        step.emailSubjectWhenDelivered || appState.email.subjectWhenDelivered,
        recipient,
        appState.campaign
      );
      const deliveredEmailBody = fillTemplate(
        step.emailBodyWhenDelivered || appState.email.bodyWhenDelivered,
        recipient,
        appState.campaign
      );

      return {
        recipient: {
          name: recipient.name,
          email: recipient.email,
          company: recipient.company,
          address: formatAddress(recipient),
          assignedTo: recipient.assignedTo || "",
          assignmentNote: recipient.assignmentNote || "",
        },
        schedule: {
          stepName: step.name,
          delayDays: step.delayDays,
          campaignStartDate: appState.campaign.startDate,
          scheduledDate,
        },
        item: {
          name: step.itemName,
          asin: step.asin,
          url: step.itemUrl,
          quantity: step.quantity,
        },
        messaging: {
          renderedMessage,
          giftReceiptMessage: renderedMessage,
          internalNote: step.note,
          sender: appState.campaign.owner,
          emailWhenSent: {
            subject: sentEmailSubject,
            body: sentEmailBody,
          },
          emailWhenDelivered: {
            subject: deliveredEmailSubject,
            body: deliveredEmailBody,
          },
        },
        orderKey,
        isDueOnRunDate: scheduledDate <= runDate,
        existingStatus: existingOrder ? existingOrder.status : "not_processed",
        amazonBusinessPayload: {
          externalId: slugify(`${appState.campaign.name}-${recipient.email}-${step.order}`),
          lineItems: [
          {
            productId: step.asin,
            quantity: step.quantity,
          },
        ],
          shippingAddress: {
            name: recipient.name,
            addressLine1: recipient.street,
            city: recipient.city,
            state: recipient.state,
            postalCode: recipient.zip,
          },
          giftReceiptMessage: renderedMessage,
          metadata: {
            assignedTo: recipient.assignedTo || "",
            scheduledDate,
            mode: appState.execution.amazonMode,
            emailTrigger: appState.email.trigger,
          },
        },
      };
    })
  );
}

function parseManualRecipients(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [
        name = "",
        email = "",
        company = "",
        street = "",
        city = "",
        state = "",
        zip = "",
        assignedTo = "",
      ] = line.split("|").map((part) => part.trim());

      return normalizeRecipient({
        id: crypto.randomUUID(),
        source: "manual",
        name,
        email,
        company,
        street,
        city,
        state,
        zip,
        assignedTo,
        assignmentNote: "",
      }, appState.orderHistory);
    });
}

function normalizeRecipient(recipient, orderHistory) {
  const normalizedEmail = recipient.email.trim().toLowerCase();
  const priorEnrollmentCount = countPriorEnrollments(normalizedEmail, orderHistory);

  return {
    ...recipient,
    email: normalizedEmail,
    hasPriorEnrollment: priorEnrollmentCount > 0,
    priorEnrollmentCount,
  };
}

function mergeRecipients(existingRecipients, incomingRecipients, orderHistory) {
  const recipients = [...existingRecipients];
  const existingEmails = new Set(existingRecipients.map((recipient) => recipient.email.trim().toLowerCase()));
  const warnings = [];
  let addedCount = 0;

  incomingRecipients.forEach((recipient) => {
    const normalized = normalizeRecipient(recipient, orderHistory);
    const email = normalized.email;
    if (!email) {
      return;
    }

    if (existingEmails.has(email)) {
      warnings.push(`${normalized.name || email} is already in this campaign.`);
      return;
    }

    if (normalized.hasPriorEnrollment) {
      warnings.push(
        `${normalized.name || email} has been enrolled ${normalized.priorEnrollmentCount} time(s) before.`
      );
    }

    recipients.push(normalized);
    existingEmails.add(email);
    addedCount += 1;
  });

  return {
    recipients,
    warnings,
    addedCount,
  };
}

function countPriorEnrollments(email, orderHistory) {
  if (!email) {
    return 0;
  }

  return orderHistory.filter((entry) => entry.recipientEmail?.trim().toLowerCase() === email).length;
}

function buildEnrollmentWarning(warnings) {
  return warnings.length ? warnings.join(" ") : "";
}

function fillTemplate(template, recipient, campaign) {
  return template
    .replaceAll("{{firstName}}", firstName(recipient.name))
    .replaceAll("{{fullName}}", recipient.name || "")
    .replaceAll("{{company}}", recipient.company || "")
    .replaceAll("{{campaignName}}", campaign.name || "")
    .replaceAll("{{senderName}}", campaign.owner || "");
}

function firstName(name) {
  return (name || "").trim().split(" ").filter(Boolean)[0] || "there";
}

function formatAddress(recipient) {
  return [recipient.street, recipient.city, recipient.state, recipient.zip]
    .filter(Boolean)
    .join(", ");
}

function blankStep(existingSteps) {
  const order = existingSteps.length + 1;
  const previousDelay = existingSteps.length
    ? Number(existingSteps[existingSteps.length - 1].delayDays || 0)
    : -7;

  return {
    id: crypto.randomUUID(),
    order,
    name: `Step ${order}`,
    delayDays: previousDelay + 7,
    itemName: "",
    asin: "",
    itemUrl: "",
    quantity: 1,
    message: "",
    emailSubjectWhenSent: "",
    emailBodyWhenSent: "",
    emailSubjectWhenDelivered: "",
    emailBodyWhenDelivered: "",
    note: "",
  };
}

function seedThreeStepSequence() {
  return [
    {
      id: crypto.randomUUID(),
      order: 1,
      name: "Warm intro gift",
      delayDays: 0,
      itemName: "Science-themed socks gift",
      asin: "B0DJR34TC7",
      itemUrl:
        "https://www.amazon.com/Eurzom-Science-Graduation-Mathematicians-Scientists/dp/B0DJR34TC7/ref=sr_1_1_sspa",
      quantity: 1,
      message:
        "Hi {{firstName}}, I wanted to send a small gift as a thank-you for the conversation around {{company}}. Looking forward to staying in touch. - {{senderName}}",
      emailSubjectWhenSent: "A small thank-you gift is on the way",
      emailBodyWhenSent:
        "Hi {{firstName}}, I just sent a small thank-you gift your way. I appreciated the conversation around {{company}} and wanted to send something thoughtful. - {{senderName}}",
      emailSubjectWhenDelivered: "Your thank-you gift has arrived",
      emailBodyWhenDelivered:
        "Hi {{firstName}}, your thank-you gift should have arrived. I wanted to make sure it reached you and say thanks again for the conversation. - {{senderName}}",
      note: "Good first-touch item.",
    },
    {
      id: crypto.randomUUID(),
      order: 2,
      name: "Follow-up touch",
      delayDays: 7,
      itemName: "Amazon item 2",
      asin: "B07BMKD3FY",
      itemUrl: "https://www.amazon.com/dp/B07BMKD3FY",
      quantity: 1,
      message:
        "Hi {{firstName}}, sending another small item to keep {{campaignName}} top of mind. If it makes sense, I would love to reconnect this week. - {{senderName}}",
      emailSubjectWhenSent: "A follow-up gift is headed your way",
      emailBodyWhenSent:
        "Hi {{firstName}}, I just sent a quick follow-up gift. If this is relevant for {{company}}, I would love to reconnect soon. - {{senderName}}",
      emailSubjectWhenDelivered: "Your follow-up gift was delivered",
      emailBodyWhenDelivered:
        "Hi {{firstName}}, your follow-up gift should have been delivered. If timing is right, I would be glad to reconnect. - {{senderName}}",
      note: "Use after first outreach.",
    },
    {
      id: crypto.randomUUID(),
      order: 3,
      name: "Last sequence send",
      delayDays: 14,
      itemName: "Amazon item 3",
      asin: "B0FJ7HZSHQ",
      itemUrl: "https://www.amazon.com/dp/B0FJ7HZSHQ",
      quantity: 1,
      message:
        "Hi {{firstName}}, one last thank-you from me. If this is relevant for {{company}}, I would be glad to set up a short intro. - {{senderName}}",
      emailSubjectWhenSent: "One last gift from me",
      emailBodyWhenSent:
        "Hi {{firstName}}, I just sent one last gift your way. If this is useful for {{company}}, I would be glad to set up a short introduction. - {{senderName}}",
      emailSubjectWhenDelivered: "Your final gift has arrived",
      emailBodyWhenDelivered:
        "Hi {{firstName}}, your final gift should have arrived. If it makes sense to continue the conversation, I would be glad to connect. - {{senderName}}",
      note: "Last gift in default sequence.",
    },
  ];
}

function normalizeState(state) {
  const base = seedState();
  const orderHistory = Array.isArray(state.orderHistory) ? state.orderHistory : [];
  return {
    campaign: {
      ...base.campaign,
      ...(state.campaign || {}),
    },
    steps: Array.isArray(state.steps) && state.steps.length ? state.steps : base.steps,
    recipients: Array.isArray(state.recipients)
      ? state.recipients.map((recipient) => normalizeRecipient(recipient, orderHistory))
      : [],
    execution: {
      ...base.execution,
      ...(state.execution || {}),
    },
    amazon: {
      ...base.amazon,
      ...(state.amazon || {}),
    },
    email: {
      ...base.email,
      ...(state.email || {}),
    },
    orderHistory,
  };
}

function seedState() {
  return {
    campaign: {
      name: "Q2 Prospect Gifting",
      goal: "Send thoughtful physical touches to qualified prospects and track who received what.",
      owner: "Your Name",
      startDate: todayIso(),
      targetFilter: "Sales qualified prospects",
    },
    steps: seedThreeStepSequence(),
    recipients: [],
    execution: {
      amazonMode: "queue-only",
      shippingDefaults: "Signature: Your Name",
    },
    amazon: {
      region: "na",
      marketplace: "",
      clientId: "",
      refreshToken: "",
      endpoint: "https://api.business.amazon.com",
    },
    email: {
      enabled: "disabled",
      trigger: "sent",
      host: "",
      port: 587,
      fromAddress: "",
      username: "",
      password: "",
      subjectWhenSent: "A gift is on the way for you",
      bodyWhenSent:
        "Hi {{firstName}}, I just sent a small gift your way. I wanted to say thanks for the conversation around {{company}}. - {{senderName}}",
      subjectWhenDelivered: "Your gift was delivered",
      bodyWhenDelivered:
        "Hi {{firstName}}, your gift should have been delivered. I wanted to make sure it reached you and say thanks again. - {{senderName}}",
    },
    orderHistory: [],
  };
}

function amazonReady(state) {
  return Boolean(
    state.execution.amazonMode === "amazon-business-ready" &&
      state.amazon.clientId &&
      state.amazon.refreshToken &&
      state.amazon.endpoint &&
      state.amazon.region
  );
}

function emailReady(state) {
  return Boolean(
    state.email.enabled === "enabled" &&
      state.email.host &&
      state.email.port &&
      state.email.fromAddress &&
      state.email.username &&
      state.email.password
  );
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}


function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
