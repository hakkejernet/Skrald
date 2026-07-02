(function () {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const convertBtn = document.getElementById('convertBtn');
  const fileListEl = document.getElementById('fileList');
  const resultsEl = document.getElementById('results');
  const statusEl = document.getElementById('status');

  /** @type {{file: File, name: string}[]} */
  let selectedFiles = [];

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
    nameInput.addEventListener('input', () => { stop.name = nameInput.value; });

    const streetInput = document.createElement('input');
    streetInput.type = 'text';
    streetInput.value = stop.street;
    streetInput.placeholder = 'Vej + husnr';
    streetInput.addEventListener('input', () => { stop.street = streetInput.value; });

    const cityInput = document.createElement('input');
    cityInput.type = 'text';
    cityInput.value = stop.cityLine;
    cityInput.placeholder = 'Postnr + by';
    cityInput.addEventListener('input', () => { stop.cityLine = cityInput.value; });

    fields.appendChild(nameInput);
    fields.appendChild(streetInput);
    fields.appendChild(cityInput);
    row.appendChild(fields);

    if (!stop.ok) {
      const warn = document.createElement('div');
      warn.className = 'stop-row__badge';
      warn.textContent = 'Tjek';
      warn.title = 'Kunne ikke tolke adressen sikkert - kontrollér felterne';
      row.appendChild(warn);
    }

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
        const stops = addresses.map(parseAddress);
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
})();
