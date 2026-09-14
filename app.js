(function () {
  'use strict';

  // 관리자 PIN — 행사 전에 원하는 숫자로 바꿔주세요.
  var ADMIN_PIN = '1220';
  var STORAGE_KEY = 'aiFestaGuestbookNotes_v1';
  var TITLE_STORAGE_KEY = 'aiFestaGuestbookTitle_v1';
  var DEFAULT_TITLE = 'AI 페스타 방명록';
  var MAX_UNDO = 25;

  var els = {
    board: document.getElementById('board'),
    emptyState: document.getElementById('emptyState'),
    newNoteBtn: document.getElementById('newNoteBtn'),
    adminToggleBtn: document.getElementById('adminToggleBtn'),
    adminIcon: document.getElementById('adminIcon'),
    adminBar: document.getElementById('adminBar'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    captureBtn: document.getElementById('captureBtn'),

    pageTitle: document.getElementById('pageTitle'),
    editTitleBtn: document.getElementById('editTitleBtn'),
    titleModal: document.getElementById('titleModal'),
    titleInput: document.getElementById('titleInput'),
    titleCancelBtn: document.getElementById('titleCancelBtn'),
    titleConfirmBtn: document.getElementById('titleConfirmBtn'),

    editorModal: document.getElementById('editorModal'),
    closeEditorBtn: document.getElementById('closeEditorBtn'),
    cancelNoteBtn: document.getElementById('cancelNoteBtn'),
    stickNoteBtn: document.getElementById('stickNoteBtn'),
    noteCanvasFrame: document.getElementById('noteCanvasFrame'),
    noteCanvas: document.getElementById('noteCanvas'),
    bgSwatches: document.getElementById('bgSwatches'),
    penSwatches: document.getElementById('penSwatches'),
    sizeRow: document.getElementById('sizeRow'),
    heartRateRow: document.getElementById('heartRateRow'),
    authorInput: document.getElementById('authorInput'),
    eraserBtn: document.getElementById('eraserBtn'),
    undoBtn: document.getElementById('undoBtn'),
    clearCanvasBtn: document.getElementById('clearCanvasBtn'),

    pinModal: document.getElementById('pinModal'),
    pinInput: document.getElementById('pinInput'),
    pinError: document.getElementById('pinError'),
    pinCancelBtn: document.getElementById('pinCancelBtn'),
    pinConfirmBtn: document.getElementById('pinConfirmBtn'),

    deleteModal: document.getElementById('deleteModal'),
    deleteCancelBtn: document.getElementById('deleteCancelBtn'),
    deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),

    gaugeFill: document.getElementById('gaugeFill'),
    gaugeHeart: document.getElementById('gaugeHeart'),
    gaugeSub: document.getElementById('gaugeSub'),

    toast: document.getElementById('toast')
  };

  var state = {
    notes: loadNotes(),
    adminMode: false,
    penColor: '#3D2C6D',
    penSize: 9,
    bgColor: '#FFE29A',
    sentiment: 3,
    erasing: false,
    hasDrawn: false,
    drawing: false,
    lastX: 0,
    lastY: 0,
    undoStack: [],
    pendingDeleteId: null,
    pendingClearAll: false
  };

  var ctx = els.noteCanvas.getContext('2d');

  // ---------- Storage ----------
  function loadNotes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    } catch (e) {
      showToast('저장 공간이 가득 찼어요 😢');
    }
  }

  function loadTitle() {
    try {
      return localStorage.getItem(TITLE_STORAGE_KEY) || DEFAULT_TITLE;
    } catch (e) {
      return DEFAULT_TITLE;
    }
  }

  function applyTitle(title) {
    els.pageTitle.textContent = title;
    document.title = title;
  }

  function saveTitle(title) {
    try {
      localStorage.setItem(TITLE_STORAGE_KEY, title);
    } catch (e) { /* ignore */ }
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.add('hidden');
    }, 1900);
  }

  // ---------- Confetti ----------
  var CONFETTI_EMOJI = ['✨', '💖', '⭐️', '🎉', '💫'];
  function burstConfetti(x, y) {
    for (var i = 0; i < 10; i++) {
      var piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
      var angle = (Math.random() * Math.PI * 2);
      var dist = 30 + Math.random() * 60;
      piece.style.left = (x + Math.cos(angle) * dist) + 'px';
      piece.style.top = (y + Math.sin(angle) * dist) + 'px';
      document.body.appendChild(piece);
      (function (p) {
        setTimeout(function () { p.remove(); }, 1200);
      })(piece);
    }
  }

  // ---------- Instagram-style heart burst ----------
  var HEART_EMOJI = ['💖', '💕', '❤️', '💗', '💘'];
  function burstHearts(x, y) {
    var pop = document.createElement('span');
    pop.className = 'heart-pop';
    pop.textContent = '❤️';
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    document.body.appendChild(pop);
    setTimeout(function () { pop.remove(); }, 650);

    for (var i = 0; i < 9; i++) {
      var h = document.createElement('span');
      h.className = 'heart-particle';
      h.textContent = HEART_EMOJI[Math.floor(Math.random() * HEART_EMOJI.length)];
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      var dist = 40 + Math.random() * 80;
      h.style.left = x + 'px';
      h.style.top = y + 'px';
      h.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
      h.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
      h.style.setProperty('--rz', (Math.random() * 60 - 30) + 'deg');
      document.body.appendChild(h);
      (function (p) {
        setTimeout(function () { p.remove(); }, 950);
      })(h);
    }
  }

  // ---------- AI 감성 게이지 ----------
  function computeSentimentStats() {
    if (state.notes.length === 0) return null;
    var total = 0;
    state.notes.forEach(function (n) { total += (n.sentiment || 3); });
    var avg = total / state.notes.length;
    var pct = ((avg - 1) / 4) * 100;
    return { avg: avg, pct: Math.max(0, Math.min(100, pct)), count: state.notes.length };
  }

  function sentimentLabel(pct) {
    if (pct < 20) return '🌱 이제 막 시작했어요';
    if (pct < 40) return '🙂 잔잔하게 좋아요';
    if (pct < 60) return '😊 훈훈한 분위기예요';
    if (pct < 80) return '🥰 정말 행복해 보여요';
    return '💖 사랑이 넘쳐흘러요!';
  }

  function updateGauge() {
    var stats = computeSentimentStats();
    if (!stats) {
      els.gaugeFill.style.width = '0%';
      els.gaugeHeart.style.left = '0%';
      els.gaugeSub.textContent = '아직 포스트잇이 없어요';
      return;
    }
    els.gaugeFill.style.width = stats.pct + '%';
    els.gaugeHeart.style.left = stats.pct + '%';
    els.gaugeSub.textContent = sentimentLabel(stats.pct) + ' · 평균 ' + stats.avg.toFixed(1) + '/5 (' + stats.count + '개 분석)';
  }

  // ---------- Board rendering ----------
  function hashRotation(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) | 0; }
    return ((h % 14) - 7); // -7..7 deg
  }

  function randomPosition() {
    return {
      x: 4 + Math.random() * 64,  // 4% ~ 68%
      y: 5 + Math.random() * 50   // 5% ~ 55%
    };
  }

  function clampNum(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return mm + '.' + dd;
  }

  function renderBoard() {
    var frag = document.createDocumentFragment();
    els.board.querySelectorAll('.note').forEach(function (n) { n.remove(); });

    if (state.notes.length === 0) {
      els.emptyState.classList.remove('hidden');
    } else {
      els.emptyState.classList.add('hidden');
    }

    state.notes.forEach(function (note) {
      var div = document.createElement('div');
      div.className = 'note';
      div.style.setProperty('--note-color', note.bgColor);
      div.style.setProperty('--rot', (note.rot != null ? note.rot : hashRotation(note.id)) + 'deg');
      div.style.left = (note.x != null ? note.x : 40) + '%';
      div.style.top = (note.y != null ? note.y : 30) + '%';
      div.dataset.id = note.id;
      div.tabIndex = 0;

      var pin = document.createElement('span');
      pin.className = 'pin';
      pin.textContent = '📌';
      div.appendChild(pin);

      var sentimentBadge = document.createElement('span');
      sentimentBadge.className = 'note-sentiment';
      sentimentBadge.textContent = '❤️' + (note.sentiment || 3);
      div.appendChild(sentimentBadge);

      var img = document.createElement('img');
      img.className = 'drawing';
      img.src = note.drawing;
      img.alt = '학생 손글씨 포스트잇';
      div.appendChild(img);

      if (note.author) {
        var author = document.createElement('span');
        author.className = 'note-author';
        author.textContent = note.author;
        div.appendChild(author);
      }

      var meta = document.createElement('span');
      meta.className = 'note-meta';
      meta.textContent = formatDate(note.ts);
      div.appendChild(meta);

      var del = document.createElement('button');
      del.className = 'delete-x';
      del.textContent = '✕';
      del.setAttribute('aria-label', '포스트잇 삭제');
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!state.adminMode) return;
        openDeleteModal(note.id);
      });
      div.appendChild(del);

      attachDragHandlers(div, note);
      frag.appendChild(div);
    });

    els.board.appendChild(frag);
    updateGauge();
  }

  // ---------- Free placement (drag to reposition) ----------
  function attachDragHandlers(div, note) {
    var startClientX = 0, startClientY = 0, startLeft = 0, startTop = 0;
    var dragging = false, moved = false;

    div.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.delete-x')) return;
      div.setPointerCapture(e.pointerId);
      startClientX = e.clientX;
      startClientY = e.clientY;
      startLeft = div.offsetLeft;
      startTop = div.offsetTop;
      dragging = true;
      moved = false;
    });

    div.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startClientX;
      var dy = e.clientY - startClientY;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        div.classList.add('dragging');
      }
      if (!moved) return;
      e.preventDefault();
      var maxLeft = Math.max(0, els.board.clientWidth - div.offsetWidth);
      var maxTop = Math.max(0, els.board.clientHeight - div.offsetHeight);
      div.style.left = clampNum(startLeft + dx, 0, maxLeft) + 'px';
      div.style.top = clampNum(startTop + dy, 0, maxTop) + 'px';
    });

    function finishDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      div.classList.remove('dragging');
      var xPct = (div.offsetLeft / els.board.clientWidth) * 100;
      var yPct = (div.offsetTop / els.board.clientHeight) * 100;
      note.x = xPct;
      note.y = yPct;
      div.style.left = xPct + '%';
      div.style.top = yPct + '%';
      saveNotes();
    }
    div.addEventListener('pointerup', finishDrag);
    div.addEventListener('pointercancel', finishDrag);
  }

  // ---------- Note editor: canvas setup ----------
  function resizeCanvasBacking() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssSize = els.noteCanvas.getBoundingClientRect().width || 280;
    els.noteCanvas.width = cssSize * dpr;
    els.noteCanvas.height = cssSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pushUndo() {
    try {
      var snap = els.noteCanvas.toDataURL('image/png');
      state.undoStack.push(snap);
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    } catch (e) { /* ignore */ }
  }

  function restoreSnapshot(dataUrl) {
    var img = new Image();
    img.onload = function () {
      var cssSize = els.noteCanvas.getBoundingClientRect().width || 280;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, els.noteCanvas.width, els.noteCanvas.height);
      ctx.restore();
      ctx.drawImage(img, 0, 0, cssSize, cssSize);
    };
    img.src = dataUrl;
  }

  function getPos(evt) {
    var rect = els.noteCanvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function startDraw(evt) {
    evt.preventDefault();
    state.drawing = true;
    var p = getPos(evt);
    state.lastX = p.x;
    state.lastY = p.y;
    // 점 찍기 (클릭만 해도 표시되도록)
    drawSegment(p.x, p.y, p.x + 0.1, p.y + 0.1, evt.pressure);
  }

  function moveDraw(evt) {
    if (!state.drawing) return;
    evt.preventDefault();
    var p = getPos(evt);
    drawSegment(state.lastX, state.lastY, p.x, p.y, evt.pressure);
    state.lastX = p.x;
    state.lastY = p.y;
  }

  function endDraw(evt) {
    if (!state.drawing) return;
    state.drawing = false;
    pushUndo();
  }

  function drawSegment(x0, y0, x1, y1, pressure) {
    state.hasDrawn = true;
    var pr = pressure && pressure > 0 ? pressure : 0.6;
    var width = state.erasing ? state.penSize * 2.2 : state.penSize * (0.55 + pr * 0.9);
    ctx.globalCompositeOperation = state.erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = state.penColor;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  els.noteCanvas.addEventListener('pointerdown', function (e) {
    els.noteCanvas.setPointerCapture(e.pointerId);
    startDraw(e);
  });
  els.noteCanvas.addEventListener('pointermove', moveDraw);
  els.noteCanvas.addEventListener('pointerup', endDraw);
  els.noteCanvas.addEventListener('pointercancel', endDraw);
  els.noteCanvas.addEventListener('pointerleave', function (e) {
    if (state.drawing) endDraw(e);
  });

  function clearCanvas(record) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.noteCanvas.width, els.noteCanvas.height);
    ctx.restore();
    if (record) pushUndo();
  }

  // ---------- Editor controls ----------
  function selectSwatch(container, selector, valueAttr) {
    container.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function () {
        container.querySelectorAll(selector).forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        if (valueAttr === 'bg') {
          state.bgColor = btn.dataset.color;
          els.noteCanvasFrame.style.setProperty('--note-color', state.bgColor);
        } else {
          state.penColor = btn.dataset.pen;
          state.erasing = false;
          els.eraserBtn.classList.remove('active');
        }
      });
    });
  }
  selectSwatch(els.bgSwatches, '.swatch[data-color]', 'bg');
  selectSwatch(els.penSwatches, '.swatch[data-pen]', 'pen');

  els.sizeRow.querySelectorAll('.size-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      els.sizeRow.querySelectorAll('.size-btn').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.penSize = parseFloat(btn.dataset.size);
    });
  });

  function renderHeartRate() {
    els.heartRateRow.querySelectorAll('.heart-btn').forEach(function (btn) {
      var v = parseInt(btn.dataset.value, 10);
      btn.textContent = v <= state.sentiment ? '❤️' : '🤍';
    });
  }

  els.heartRateRow.querySelectorAll('.heart-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.sentiment = parseInt(btn.dataset.value, 10);
      renderHeartRate();

      var rect = btn.getBoundingClientRect();
      burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);

      btn.classList.remove('bounce');
      void btn.offsetWidth;
      btn.classList.add('bounce');
    });
  });

  els.eraserBtn.addEventListener('click', function () {
    state.erasing = !state.erasing;
    els.eraserBtn.classList.toggle('active', state.erasing);
  });

  els.undoBtn.addEventListener('click', function () {
    if (state.undoStack.length <= 1) {
      clearCanvas(false);
      state.undoStack = [];
      state.hasDrawn = false;
      return;
    }
    state.undoStack.pop();
    var prev = state.undoStack[state.undoStack.length - 1];
    restoreSnapshot(prev);
  });

  els.clearCanvasBtn.addEventListener('click', function () {
    clearCanvas(true);
    state.hasDrawn = false;
  });

  function resetEditor() {
    clearCanvas(false);
    state.undoStack = [];
    state.hasDrawn = false;
    state.erasing = false;
    els.eraserBtn.classList.remove('active');
    els.authorInput.value = '';

    state.bgColor = '#FFE29A';
    state.penColor = '#3D2C6D';
    state.penSize = 9;
    state.sentiment = 3;
    els.noteCanvasFrame.style.setProperty('--note-color', state.bgColor);

    els.bgSwatches.querySelectorAll('.swatch').forEach(function (b, i) { b.classList.toggle('selected', i === 0); });
    els.penSwatches.querySelectorAll('.swatch').forEach(function (b, i) { b.classList.toggle('selected', i === 0); });
    els.sizeRow.querySelectorAll('.size-btn').forEach(function (b, i) { b.classList.toggle('selected', i === 1); });
    renderHeartRate();

    pushUndo();
  }

  // ---------- Editor modal open/close ----------
  function openEditor() {
    els.editorModal.classList.remove('hidden');
    requestAnimationFrame(function () {
      resizeCanvasBacking();
      resetEditor();
    });
  }
  function closeEditor() {
    els.editorModal.classList.add('hidden');
  }

  els.newNoteBtn.addEventListener('click', openEditor);
  els.closeEditorBtn.addEventListener('click', closeEditor);
  els.cancelNoteBtn.addEventListener('click', closeEditor);
  els.editorModal.addEventListener('click', function (e) {
    if (e.target === els.editorModal) closeEditor();
  });

  els.stickNoteBtn.addEventListener('click', function () {
    if (!state.hasDrawn) {
      showToast('포스트잇에 먼저 그림이나 글씨를 남겨줘 ✏️');
      return;
    }
    var dataUrl = els.noteCanvas.toDataURL('image/png');
    var id = 'note_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var pos = randomPosition();
    var note = {
      id: id,
      bgColor: state.bgColor,
      drawing: dataUrl,
      author: els.authorInput.value.trim().slice(0, 10),
      ts: Date.now(),
      rot: hashRotation(id),
      x: pos.x,
      y: pos.y,
      sentiment: state.sentiment
    };
    state.notes.push(note);
    saveNotes();
    renderBoard();
    closeEditor();

    var fabRect = els.newNoteBtn.getBoundingClientRect();
    burstConfetti(fabRect.left + fabRect.width / 2, fabRect.top);
    showToast('포스트잇을 붙였어요! 💌');
  });

  // ---------- Admin ----------
  function enterAdminMode() {
    state.adminMode = true;
    document.body.classList.add('admin-mode');
    els.adminToggleBtn.classList.add('active');
    els.adminIcon.textContent = '🔓';
    els.adminBar.classList.remove('hidden');
  }
  function exitAdminMode() {
    state.adminMode = false;
    document.body.classList.remove('admin-mode');
    els.adminToggleBtn.classList.remove('active');
    els.adminIcon.textContent = '🔒';
    els.adminBar.classList.add('hidden');
  }

  els.adminToggleBtn.addEventListener('click', function () {
    if (state.adminMode) {
      exitAdminMode();
    } else {
      openPinModal();
    }
  });

  // ---------- Title editing (admin only) ----------
  function openTitleModal() {
    if (!state.adminMode) return;
    els.titleInput.value = els.pageTitle.textContent;
    els.titleModal.classList.remove('hidden');
    setTimeout(function () { els.titleInput.focus(); els.titleInput.select(); }, 50);
  }
  function closeTitleModal() {
    els.titleModal.classList.add('hidden');
  }
  function confirmTitleEdit() {
    var next = els.titleInput.value.trim();
    if (!next) {
      showToast('제목을 입력해줘 ✏️');
      return;
    }
    applyTitle(next);
    saveTitle(next);
    closeTitleModal();
    showToast('제목을 변경했어요 ✨');
  }

  els.editTitleBtn.addEventListener('click', openTitleModal);
  els.titleCancelBtn.addEventListener('click', closeTitleModal);
  els.titleConfirmBtn.addEventListener('click', confirmTitleEdit);
  els.titleModal.addEventListener('click', function (e) {
    if (e.target === els.titleModal) closeTitleModal();
  });
  els.titleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmTitleEdit();
  });

  // ---------- Capture (save guestbook board as an image) ----------
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function formatCaptureDate(d) {
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  function buildCaptureFilename() {
    var safe = (els.pageTitle.textContent || 'guestbook').trim().replace(/\s+/g, '_');
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    return safe + '_' + stamp + '.png';
  }

  function drawNoteOnCanvas(c, note, panelX, panelY, scale) {
    return new Promise(function (resolve) {
      var el = els.board.querySelector('.note[data-id="' + note.id + '"]');
      if (!el) { resolve(); return; }
      var x = panelX + el.offsetLeft * scale;
      var y = panelY + el.offsetTop * scale;
      var w = el.offsetWidth * scale;
      var h = el.offsetHeight * scale;
      var rotDeg = note.rot || 0;

      var img = new Image();
      img.onload = function () {
        c.save();
        c.translate(x + w / 2, y + h / 2);
        c.rotate(rotDeg * Math.PI / 180);

        c.save();
        c.shadowColor = 'rgba(61,44,109,0.35)';
        c.shadowBlur = 14 * scale;
        c.shadowOffsetY = 6 * scale;
        roundRectPath(c, -w / 2, -h / 2, w, h, 6 * scale);
        c.fillStyle = note.bgColor;
        c.fill();
        c.restore();

        var inset = 8 * scale;
        c.drawImage(img, -w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);

        if (note.author) {
          c.font = '700 ' + Math.round(12 * scale) + 'px Gaegu, sans-serif';
          c.fillStyle = 'rgba(61,44,109,0.65)';
          c.textAlign = 'left';
          c.fillText(note.author, -w / 2 + 10 * scale, h / 2 - 8 * scale);
        }

        c.font = '400 ' + Math.round(11 * scale) + 'px Gaegu, sans-serif';
        c.fillStyle = 'rgba(61,44,109,0.55)';
        c.textAlign = 'right';
        c.fillText(formatDate(note.ts), w / 2 - 10 * scale, h / 2 - 8 * scale);

        c.font = Math.round(20 * scale) + 'px sans-serif';
        c.textAlign = 'center';
        c.fillText('📌', 0, -h / 2 - 2 * scale);

        c.restore();
        resolve();
      };
      img.onerror = function () { resolve(); };
      img.src = note.drawing;
    });
  }

  async function renderCaptureCanvas() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* ignore */ }
    }

    var scale = 2;
    var boardRect = els.board.getBoundingClientRect();
    var panelW = Math.round(boardRect.width * scale);
    var panelH = Math.round(boardRect.height * scale);
    var headerH = Math.round(100 * scale);
    var pad = Math.round(28 * scale);

    var canvas = document.createElement('canvas');
    canvas.width = panelW + pad * 2;
    canvas.height = panelH + headerH + pad * 2;
    var c = canvas.getContext('2d');

    var bgGrad = c.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#F4EEFF');
    bgGrad.addColorStop(0.55, '#E4D9FB');
    bgGrad.addColorStop(1, '#D8C6F7');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.textAlign = 'center';
    c.fillStyle = '#3D2C6D';
    c.font = '700 ' + Math.round(30 * scale) + 'px Jua, sans-serif';
    c.fillText(els.pageTitle.textContent, canvas.width / 2, pad + Math.round(34 * scale));
    c.font = '400 ' + Math.round(15 * scale) + 'px Gaegu, sans-serif';
    c.fillStyle = '#7A6FA3';
    c.fillText(formatCaptureDate(new Date()) + ' · 우리들의 이야기 🤍', canvas.width / 2, pad + Math.round(62 * scale));

    var panelX = pad;
    var panelY = headerH + pad;
    roundRectPath(c, panelX, panelY, panelW, panelH, 20 * scale);
    c.fillStyle = '#FFF9F0';
    c.fill();
    c.lineWidth = 5 * scale;
    c.strokeStyle = '#E7D6BE';
    c.stroke();

    for (var i = 0; i < state.notes.length; i++) {
      await drawNoteOnCanvas(c, state.notes[i], panelX, panelY, scale);
    }

    return canvas.toDataURL('image/png');
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  els.captureBtn.addEventListener('click', function () {
    els.captureBtn.disabled = true;
    showToast('방명록을 저장하는 중이에요... 📸');
    renderCaptureCanvas().then(function (dataUrl) {
      downloadDataUrl(dataUrl, buildCaptureFilename());
      showToast('방명록 사진을 저장했어요! 💾');
    }).catch(function () {
      showToast('캡처에 실패했어요 😢');
    }).finally(function () {
      els.captureBtn.disabled = false;
      els.captureBtn.classList.add('flash');
      setTimeout(function () { els.captureBtn.classList.remove('flash'); }, 450);
    });
  });

  function openPinModal() {
    els.pinInput.value = '';
    els.pinError.classList.add('hidden');
    els.pinModal.classList.remove('hidden');
    setTimeout(function () { els.pinInput.focus(); }, 50);
  }
  function closePinModal() {
    els.pinModal.classList.add('hidden');
  }

  els.pinCancelBtn.addEventListener('click', closePinModal);
  els.pinModal.addEventListener('click', function (e) {
    if (e.target === els.pinModal) closePinModal();
  });
  function tryPinConfirm() {
    if (els.pinInput.value === ADMIN_PIN) {
      closePinModal();
      enterAdminMode();
      showToast('관리자 모드로 전환했어요 🛠️');
    } else {
      els.pinError.classList.remove('hidden');
      els.pinInput.value = '';
      els.pinInput.focus();
    }
  }
  els.pinConfirmBtn.addEventListener('click', tryPinConfirm);
  els.pinInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryPinConfirm();
  });

  // ---------- Delete flow ----------
  function openDeleteModal(id) {
    state.pendingDeleteId = id;
    state.pendingClearAll = false;
    els.deleteModal.querySelector('h2').textContent = '🗑️ 포스트잇 삭제';
    els.deleteModal.querySelector('p').innerHTML = '이 포스트잇을 정말 삭제할까요?<br>삭제하면 되돌릴 수 없어요.';
    els.deleteModal.classList.remove('hidden');
  }
  function openClearAllModal() {
    state.pendingClearAll = true;
    state.pendingDeleteId = null;
    els.deleteModal.querySelector('h2').textContent = '🗑️ 전체 삭제';
    els.deleteModal.querySelector('p').innerHTML = '보드의 모든 포스트잇을 삭제할까요?<br>삭제하면 되돌릴 수 없어요.';
    els.deleteModal.classList.remove('hidden');
  }
  function closeDeleteModal() {
    els.deleteModal.classList.add('hidden');
    state.pendingDeleteId = null;
    state.pendingClearAll = false;
  }

  els.deleteCancelBtn.addEventListener('click', closeDeleteModal);
  els.deleteModal.addEventListener('click', function (e) {
    if (e.target === els.deleteModal) closeDeleteModal();
  });
  els.deleteConfirmBtn.addEventListener('click', function () {
    if (state.pendingClearAll) {
      state.notes = [];
      saveNotes();
      renderBoard();
      showToast('모든 포스트잇을 삭제했어요');
    } else if (state.pendingDeleteId) {
      state.notes = state.notes.filter(function (n) { return n.id !== state.pendingDeleteId; });
      saveNotes();
      renderBoard();
      showToast('포스트잇을 삭제했어요');
    }
    closeDeleteModal();
  });

  els.clearAllBtn.addEventListener('click', function () {
    if (!state.adminMode) return;
    openClearAllModal();
  });

  // ---------- Global ----------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeEditor();
      closePinModal();
      closeDeleteModal();
      closeTitleModal();
    }
  });
  window.addEventListener('resize', function () {
    if (!els.editorModal.classList.contains('hidden')) {
      var keep = els.noteCanvas.toDataURL('image/png');
      resizeCanvasBacking();
      restoreSnapshot(keep);
    }
  });

  applyTitle(loadTitle());
  renderBoard();
})();
