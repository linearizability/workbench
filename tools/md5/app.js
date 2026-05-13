(function() {
    'use strict';

    const elements = {
        input: null,
        output: null,
        btnCalc: null,
        btnClear: null,
        btnCopy: null,
        chkUppercase: null,
        fileDropZone: null,
        fileInput: null,
        fileProgress: null,
        fileProgressBar: null,
        fileProgressText: null,
        fileInfo: null
    };

    function init() {
        cacheElements();
        bindEvents();
        elements.input.focus();
    }

    function cacheElements() {
        elements.input = document.getElementById('md5-input');
        elements.output = document.getElementById('md5-output');
        elements.btnCalc = document.getElementById('btn-calc');
        elements.btnClear = document.getElementById('btn-clear');
        elements.btnCopy = document.getElementById('btn-copy');
        elements.chkUppercase = document.getElementById('chk-uppercase');
        elements.fileDropZone = document.getElementById('file-drop-zone');
        elements.fileInput = document.getElementById('file-input');
        elements.fileProgress = document.getElementById('file-progress');
        elements.fileProgressBar = document.getElementById('file-progress-bar');
        elements.fileProgressText = document.getElementById('file-progress-text');
        elements.fileInfo = document.getElementById('file-info');
    }

    function bindEvents() {
        elements.btnCalc.addEventListener('click', handleCalculate);
        elements.btnClear.addEventListener('click', handleClear);
        elements.btnCopy.addEventListener('click', handleCopy);
        elements.input.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleCalculate();
            }
        });
        elements.input.addEventListener('input', () => {
            if (!elements.output.value) return;
            handleCalculate();
        });

        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) handleFileSelect(file);
            });
        }

        if (elements.fileDropZone) {
            setupFileDropzone(elements.fileDropZone, handleFileSelect);
        }
    }

    function handleCalculate() {
        const text = elements.input.value;
        if (!text) {
            elements.output.value = '';
            elements.btnCopy.disabled = true;
            showToast('请输入内容', 'warning');
            return;
        }

        if (typeof SparkMD5 === 'undefined') {
            showToast('MD5 库加载失败，请刷新重试', 'error');
            return;
        }

        let result = SparkMD5.hash(text);
        if (elements.chkUppercase.checked) {
            result = result.toUpperCase();
        }

        elements.output.value = result;
        elements.btnCopy.disabled = false;
    }

    function handleClear() {
        elements.input.value = '';
        elements.output.value = '';
        elements.btnCopy.disabled = true;
        elements.input.focus();
        resetFileUI();
        elements.fileInfo.textContent = '';
        if (elements.fileInput) {
            elements.fileInput.value = '';
        }
    }

    function handleCopy() {
        const text = elements.output.value;
        if (!text) return;

        copyToClipboard(text).then((ok) => {
            if (ok) {
                showToast('已复制到剪贴板', 'success');
            } else {
                showToast('复制失败', 'error');
            }
        });
    }

    function handleFileSelect(file) {
        if (typeof SparkMD5 === 'undefined') {
            showToast('MD5 库加载失败，请刷新重试', 'error');
            return;
        }

        resetFileUI();
        elements.fileInfo.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
        elements.fileProgress.hidden = false;
        calculateFileMd5(file);
    }

    function calculateFileMd5(file) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const spark = new SparkMD5.ArrayBuffer();
        let offset = 0;

        function readNext() {
            const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
            const reader = new FileReader();

            reader.onload = function(e) {
                spark.append(e.target.result);
                offset += CHUNK_SIZE;

                updateFileProgress(Math.min(offset, file.size), file.size);

                if (offset < file.size) {
                    readNext();
                } else {
                    const result = spark.end();
                    let finalResult = result;
                    if (elements.chkUppercase.checked) {
                        finalResult = finalResult.toUpperCase();
                    }
                    elements.output.value = finalResult;
                    elements.btnCopy.disabled = false;
                    showToast('文件 MD5 计算完成', 'success');
                }
            };

            reader.onerror = function() {
                showToast('文件读取失败', 'error');
                resetFileUI();
            };

            reader.readAsArrayBuffer(chunk);
        }

        readNext();
    }

    function updateFileProgress(loaded, total) {
        const percent = total === 0 ? 0 : Math.round((loaded / total) * 100);
        elements.fileProgressBar.style.width = percent + '%';
        elements.fileProgressText.textContent = percent + '%';
    }

    function resetFileUI() {
        elements.fileProgress.hidden = true;
        elements.fileProgressBar.style.width = '0%';
        elements.fileProgressText.textContent = '0%';
        elements.fileInfo.textContent = '';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
    }

    init();
})();
