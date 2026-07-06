import { useCallback, useRef, useState } from 'react';

const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const MAX_SIZE_LABEL = '300 MB';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function App() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const validateAndSetFile = useCallback((candidate) => {
    setResult(null);
    setError('');

    if (!candidate) return;

    const isZip =
      candidate.name.toLowerCase().endsWith('.zip') ||
      candidate.type === 'application/zip' ||
      candidate.type === 'application/x-zip-compressed';

    if (!isZip) {
      setError('Only .zip files are accepted.');
      setFile(null);
      return;
    }

    if (candidate.size > MAX_SIZE_BYTES) {
      setError(`File is ${formatBytes(candidate.size)}. Max size is ${MAX_SIZE_LABEL}.`);
      setFile(null);
      return;
    }

    setFile(candidate);
  }, []);

  const handleInputChange = (e) => {
    validateAndSetFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file || status === 'uploading') return;

    setStatus('uploading');
    setProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus('done');
          setResult(data.file);
        } else {
          setStatus('error');
          setError(data.error || 'Upload failed.');
        }
      } catch {
        setStatus('error');
        setError('Unexpected server response.');
      }
    };

    xhr.onerror = () => {
      setStatus('error');
      setError('Could not reach the server.');
    };

    xhr.send(formData);
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="page">
      <div className="manifest-card">
        <header className="manifest-header">
          <span className="tag">ARCHIVE INTAKE</span>
          <h1>Send a .zip to storage</h1>
          <p className="subhead">Max size {MAX_SIZE_LABEL} · .zip only</p>
        </header>

        <form onSubmit={handleSubmit}>
          <label
            className={`dropzone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleInputChange}
              hidden
            />
            {!file && (
              <div className="dropzone-copy">
                <span className="dropzone-icon" aria-hidden="true">
                  ▤
                </span>
                <p>
                  <strong>Choose a file</strong> or drop it here
                </p>
              </div>
            )}
            {file && (
              <div className="file-line">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatBytes(file.size)}</span>
              </div>
            )}
          </label>

          {error && <p className="error-text">{error}</p>}

          {status === 'uploading' && (
            <div className="progress-track" aria-label="Upload progress">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-label">{progress}%</span>
            </div>
          )}

          {status === 'done' && result && (
            <div className="success-box">
              <p className="success-title">Stored</p>
              <dl>
                <dt>File</dt>
                <dd>{result.originalName}</dd>
                <dt>Size</dt>
                <dd>{formatBytes(result.size)}</dd>
                <dt>ID</dt>
                <dd className="mono">{result.id}</dd>
              </dl>
            </div>
          )}

          <div className="actions">
            {status !== 'done' ? (
              <button
                type="submit"
                className="submit-btn"
                disabled={!file || status === 'uploading'}
              >
                {status === 'uploading' ? 'Uploading…' : 'Submit'}
              </button>
            ) : (
              <button type="button" className="submit-btn secondary" onClick={reset}>
                Upload another
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
