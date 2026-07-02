(function () {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const convertBtn = document.getElementById('convertBtn');
  const fileListEl = document.getElementById('fileList');
  const resultsEl = document.getElementById('results');
  const statusEl = document.getElementById('status');
  const correctionsInfoEl = document.getElementById('correctionsInfo');

  /** @type {{file: File, name: string}[]} */
  let selectedFiles = [];

  function updateCorrectionsInfo() {
    const count = countCorrections();
    correctionsInfoEl.innerHTML = '';
    if (count === 0) return;

    const span = document.createElement('span');
    span.textContent = `${count} rettelse${count === 1 ? '' : 'r'} husket. `;
    correctionsInfoEl.appendChild(span);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'link-btn';
    resetBtn.textContent = 'Nulstil';
    resetBtn.addEventListener('click', () => {
      if (confirm('Slet alle huskede rettelser?')) {
        clearCorrections();
        updateCorrectionsInfo();
      }
    });
    correctionsInfoEl.appendChild(resetBtn);
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || '';
    statusEl.className = isError ? 'status status--error' : 'status';
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    selectedFiles.forEach((f, idx) => {
      const li = document.createElement('li');
      li.textContent = f.name;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.className = 'remove-btn';
      removeBtn.setAttribute('aria-label', `Fjern ${f.name}`);
      removeBtn.addEventListener('click', () => {
        selectedFiles.splice(idx, 1);
        renderFileList();
      });
      li.appendChild(removeBtn);
      fileListEl.appendChild(li);
    });
    convertBtn.disabled = selectedFiles.length === 0;
  }

  function addFiles(fileListLike) {
    const files = Array.from(fileListLike).filter((f) => /\.csv$/i.test(f.name));
    if (files.length === 0) {
      setStatus('Ingen CSV-filer fundet i valget.', true);
      return;
    }
    selectedFiles = selectedFiles.concat(files);
    setStatus('');
    renderFileList();
  }

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drop-zone--active');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drop-zone--active');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
    fileInput.value = '';
  });

  async function readFileSmart(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (text.includes('�')) {
      text = new TextDecoder('windows-1252').decode(buf);
    }
    return text;
  }

  function setBadge(row, stop) {
    const existing = row.querySelector('.stop-row__badge');
    if (existing) existing.remove();

    if (!stop.ok) {
      const warn = document.createElement('div');
      warn.className = 'stop-row__badge';
      warn.textContent = 'Tjek';
      warn.title = 'Kunne ikke tolke adressen sikkert - kontrollér felterne';
      row.appendChild(warn);
    } else if (stop.fromMemory) {
      const mem = document.createElement('div');
      mem.className = 'stop-row__badge stop-row__badge--memory';
      mem.textContent = '✓';
      mem.title = 'Genkendt fra en tidligere rettelse';
      row.appendChild(mem);
    }
  }

  function stopRow(stop, index) {
    const row = document.createElement('div');
    row.className = 'stop-row' + (stop.ok ? '' : ' stop-row--warn');

    const num = document.createElement('div');
    num.className = 'stop-row__num';
    num.textContent = String(index + 1);
    row.appendChild(num);

    const fields = document.createElement('div');
    fields.className = 'stop-row__fields';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = stop.name;
    nameInput.placeholder = 'Kundenavn';

    const streetInput = document.createElement('input');
    streetInput.type = 'text';
    streetInput.value = stop.street;
    streetInput.placeholder = 'Vej + husnr';

    const cityInput = document.createElement('input');
    cityInput.type = 'text';
    cityInput.value = stop.cityLine;
    cityInput.placeholder = 'Postnr + by';

    function commit() {
      stop.name = nameInput.value;
      stop.street = streetInput.value;
      stop.cityLine = cityInput.value;
      stop.ok = true;
      stop.fromMemory = false;
      row.classList.remove('stop-row--warn');
      setBadge(row, stop);
      saveCorrection(stop.original, stop);
      updateCorrectionsInfo();
    }

    nameInput.addEventListener('input', commit);
    streetInput.addEventListener('input', commit);
    cityInput.addEventListener('input', commit);

    fields.appendChild(nameInput);
    fields.appendChild(streetInput);
    fields.appendChild(cityInput);
    row.appendChild(fields);

    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'swap-btn';
    swapBtn.textContent = '⇄';
    swapBtn.title = 'Byt kundenavn og vej om';
    swapBtn.setAttribute('aria-label', 'Byt kundenavn og vej om');
    swapBtn.addEventListener('click', () => {
      const tmp = nameInput.value;
      nameInput.value = streetInput.value;
      streetInput.value = tmp;
      commit();
    });
    row.appendChild(swapBtn);

    setBadge(row, stop);

    return row;
  }

  function renderFileResult(sourceName, stops) {
    const card = document.createElement('section');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card__header';

    const title = document.createElement('h2');
    title.textContent = sourceName;
    header.appendChild(title);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn--primary';
    downloadBtn.textContent = 'Generér PDF';
    downloadBtn.addEventListener('click', () => {
      buildStopsPDF(stops, sourceName);
    });
    header.appendChild(downloadBtn);

    card.appendChild(header);

    const warnCount = stops.filter((s) => !s.ok).length;
    if (warnCount > 0) {
      const notice = document.createElement('p');
      notice.className = 'notice';
      notice.textContent = `${warnCount} adresse(r) kunne ikke tolkes sikkert og er markeret "Tjek" - ret dem herunder før du genererer PDF.`;
      card.appendChild(notice);
    }

    const list = document.createElement('div');
    list.className = 'stop-list';
    stops.forEach((stop, i) => list.appendChild(stopRow(stop, i)));
    card.appendChild(list);

    resultsEl.appendChild(card);
  }

  async function convert() {
    if (selectedFiles.length === 0) return;
    resultsEl.innerHTML = '';
    setStatus('Konverterer...');
    convertBtn.disabled = true;

    for (const file of selectedFiles) {
      try {
        const text = await readFileSmart(file);
        const { addresses, error } = extractAddresses(text);
        if (error) {
          setStatus(`${file.name}: ${error}`, true);
          continue;
        }
        const stops = applyCorrections(addresses.map(parseAddress));
        renderFileResult(file.name, stops);
      } catch (err) {
        setStatus(`${file.name}: kunne ikke læses (${err.message})`, true);
      }
    }

    setStatus('');
    convertBtn.disabled = false;
  }

  convertBtn.addEventListener('click', convert);
  renderFileList();
  updateCorrectionsInfo();
})();
