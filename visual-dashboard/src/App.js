import React, { useEffect, useState, useRef } from 'react';
  import axios from 'axios';

  // ================= STYLES =================
  const styles = {
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    },
    header: {
      backgroundColor: '#1976d2',
      color: '#fff',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    navBar: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px',
      flexWrap: 'wrap'
    },
    navButton: {
      padding: '10px 20px',
      backgroundColor: '#fff',
      border: '2px solid #ddd',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      transition: 'all 0.3s ease',
      '&:hover': { borderColor: '#1976d2', color: '#1976d2' }
    },
    activeNavButton: {
      backgroundColor: '#1976d2',
      color: '#fff',
      borderColor: '#1976d2'
    },
    section: {
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid #e0e0e0'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '15px',
      color: '#333',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    card: {
      backgroundColor: '#f9f9f9',
      padding: '15px',
      borderRadius: '6px',
      border: '1px solid #e0e0e0',
      marginBottom: '12px'
    },
    button: {
      padding: '10px 16px',
      marginRight: '8px',
      marginBottom: '8px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
      display: 'inline-block'
    },
    buttonPrimary: {
      backgroundColor: '#4caf50',
      color: '#fff'
    },
    buttonSecondary: {
      backgroundColor: '#2196f3',
      color: '#fff'
    },
    buttonWarning: {
      backgroundColor: '#ff9800',
      color: '#fff'
    },
    buttonDanger: {
      backgroundColor: '#f44336',
      color: '#fff'
    },
    progressContainer: {
      marginTop: '15px',
      marginBottom: '15px'
    },
    progressBar: {
      width: '100%',
      height: '20px',
      backgroundColor: '#e0e0e0',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '8px',
      border: '1px solid #ccc'
    },
    progressFill: {
      height: '100%',
      borderRadius: '10px',
      transition: 'width 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '11px',
      fontWeight: 'bold'
    },
    progressText: {
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#333'
    },
    logsContainer: {
      height: '250px',
      overflow: 'auto',
      backgroundColor: '#1e1e1e',
      color: '#00ff00',
      padding: '12px',
      borderRadius: '6px',
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      border: '1px solid #333',
      lineHeight: '1.4'
    },
    deviceGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '10px',
      marginBottom: '15px'
    },
    deviceToggle: {
      padding: '10px',
      borderRadius: '6px',
      border: '2px solid #ddd',
      backgroundColor: '#fff',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: '600'
    },
    statusBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginTop: '8px'
    },
    statusPass: {
      backgroundColor: '#c8e6c9',
      color: '#2e7d32'
    },
    statusFail: {
      backgroundColor: '#ffcdd2',
      color: '#c62828'
    },
    statusRunning: {
      backgroundColor: '#ffe0b2',
      color: '#e65100'
    },
    selectDropdown: {
      padding: '10px 12px',
      borderRadius: '6px',
      border: '1px solid #ddd',
      fontSize: '13px',
      marginRight: '8px',
      marginBottom: '8px',
      cursor: 'pointer',
      backgroundColor: '#fff',
      transition: 'border-color 0.2s ease'
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#555'
    }
  };

  function App() {
    // ---------------- VISUAL REFS ----------------
    const visualCompletedRef = useRef(false);
    const visualProcessedRef = useRef(0);
    const visualLogsEndRef = useRef(null);

    // ---------------- PAGE REFS ----------------
    const pageStartedRef = useRef(false);
    const completedRef = useRef(false);
    const processedURLsRef = useRef(0);
    const pageLogsEndRef = useRef(null);

    // ---------------- COMMON ----------------
    const [activePage, setActivePage] = useState('visual');
    const [activeAction, setActiveAction] = useState('');
    const [currentMode, setCurrentMode] = useState('');

    // ---------------- VISUAL ----------------
    const [visualLogs, setVisualLogs] = useState([]);
    const [baselineProgress, setBaselineProgress] = useState(0);
    const [testProgress, setTestProgress] = useState(0);
    const [visualStatus, setVisualStatus] = useState('');
    const [baselineCompleted, setBaselineCompleted] = useState(false);
    const [testCompleted, setTestCompleted] = useState(false);

    // ---------------- PAGE ----------------
    const [pageLogs, setPageLogs] = useState([]);
    const [pageProgress, setPageProgress] = useState(0);
    const [pageStatus, setPageStatus] = useState('');
    const [selectedScript, setSelectedScript] = useState('');
    const [exportReport, setExportReport] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [pageTestCompleted, setPageTestCompleted] = useState(false);

    // ---------------- RESTART ----------------
    const [serverRestartStatus, setServerRestartStatus] = useState('');   // '' | 'restarting' | 'done' | 'error'
    const [frontendRestartStatus, setFrontendRestartStatus] = useState(''); // '' | 'restarting' | 'done' | 'error'

    // ---------------- DEVICES ----------------
    const [viewports, setViewports] = useState([
      { label: 'phone', width: 375, height: 667, enabled: true },
      { label: 'tablet', width: 768, height: 1024, enabled: true },
      { label: 'desktop', width: 1366, height: 768, enabled: true }
    ]);

    const [newDevice, setNewDevice] = useState({ label: '', width: '', height: '' });
    const [deviceError, setDeviceError] = useState('');

    const selectedCount = viewports.filter(v => v.enabled).length;

    // ---------------- DELETE DIALOG ----------------
    const [confirmDialog, setConfirmDialog] = useState({
      open: false,
      type: '',
      mode: 'confirm',
      message: ''
    });

    // ---------------- DYNAMIC CONFIG ----------------
    // Total scenarios = pages.length × scenarios-per-page × viewports selected
    // Loaded dynamically from backstop.json
    const [PAGES_COUNT, setPagesCount] = useState(150);
    const [SCENARIOS_PER_PAGE, setScenariosPerPage] = useState(1);

    // ---------------- AUTO SCROLL ----------------
    useEffect(() => {
      visualLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [visualLogs]);

    useEffect(() => {
      pageLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pageLogs]);

    // ---------------- LOAD DYNAMIC CONFIG FROM BACKSTOP.JSON ----------------
    useEffect(() => {
      const loadConfig = async () => {
        try {
          const response = await fetch('/backstop.json');
          const config = await response.json();
          
          // Get page count from scenarios array
          const scenariosCount = config.scenarios?.length || 150;
          setPagesCount(scenariosCount);
          
          // Get scenarios per page from viewports array
          const viewportsCount = config.viewports?.length || 1;
          setScenariosPerPage(viewportsCount);
        } catch (error) {
          console.error('Error loading backstop.json:', error);
          // Fall back to defaults if fetch fails
          setPagesCount(150);
          setScenariosPerPage(1);
        }
      };
      
      loadConfig();
    }, []);

    // ---------------- SSE ----------------
    useEffect(() => {
      const eventSource = new EventSource('http://localhost:3001/logs');

      eventSource.onmessage = (event) => {
        const message = event.data;

        // ================= VISUAL =================
        if (currentMode === 'reference' || currentMode === 'test') {
          setVisualLogs(prev => [...prev, message]);

          if (visualCompletedRef.current) return;

          if (message.includes('SCENARIO >')) {
            visualProcessedRef.current += 1;
            const totalScenarios = PAGES_COUNT * SCENARIOS_PER_PAGE * selectedCount;
            const newProgress = Math.min(
              5 + Math.round((visualProcessedRef.current / totalScenarios) * 90),
              95
            );
            if (currentMode === 'reference') setBaselineProgress(newProgress);
            else setTestProgress(newProgress);
          }

          if (message.includes('PROCESS_COMPLETED')) {
            visualCompletedRef.current = true;
            if (currentMode === 'reference') {
              setBaselineProgress(100);
              setBaselineCompleted(true);
            } else {
              setTestProgress(100);
              setTestCompleted(true);
            }
            setActiveAction('');
          }
        }

        // ================= PAGE VERIFICATION =================
        if (currentMode === 'broken-links') {
          setPageLogs(prev => [...prev, message]);

          const isCompletion =
            /^\d+ (passed|failed) \(/.test(message.trim()) ||
            message.includes('PROCESS_COMPLETED');

          if (completedRef.current) return;

          if (!pageStartedRef.current && !isCompletion) {
            pageStartedRef.current = true;
            setPageProgress(5);
          }

          const isTestResult = /^[✓✗×]\s+\d+\s+\[/.test(message.trim());

          if (pageStartedRef.current && !isCompletion && isTestResult) {
            processedURLsRef.current += 1;
            const total = 150;
            const newProgress = Math.min(5 + Math.round((processedURLsRef.current / total) * 90), 95);
            setPageProgress(newProgress);
          }

          if (isCompletion && pageStartedRef.current) {
            completedRef.current = true;
            setPageProgress(100);
            setPageTestCompleted(true);
            setActiveAction('');
            if (/^\d+ passed \(/.test(message.trim())) setPageStatus('PASS');
            else if (/^\d+ failed \(/.test(message.trim())) setPageStatus('FAIL');
          }
        }
      };

      return () => eventSource.close();
    }, [currentMode, selectedCount]);

    // ---------------- RUN VISUAL ----------------
    const runTest = async (mode) => {
      if (selectedCount === 0) return;

      visualCompletedRef.current = false;
      visualProcessedRef.current = 0;

      setActiveAction(mode);
      setVisualLogs([]);
      setBaselineProgress(0);
      setTestProgress(0);
      setVisualStatus('');
      setBaselineCompleted(false);
      setTestCompleted(false);
      setCurrentMode(mode);

      await axios.post('http://localhost:3001/run-test', {
        mode,
        viewports: viewports.filter(v => v.enabled)
      });
    };

    // ---------------- RUN PAGE ----------------
    const runBrokenLinks = async () => {
      if (!selectedScript) return;

      pageStartedRef.current = false;
      completedRef.current = false;
      processedURLsRef.current = 0;

      setActiveAction('broken-links');
      setPageLogs([]);
      setPageProgress(0);
      setPageStatus('');
      setPageTestCompleted(false);
      setCurrentMode('broken-links');

      await axios.post('http://localhost:3001/run-broken-links', {
        script: selectedScript
      });
    };

    // ---------------- EXPORT REPORT ----------------
    const handleExportReport = async (type) => {
      if (!type) return;
      setDownloadError('');
      setExportReport('');

      try {
        const res = await fetch(`http://localhost:3001/download-report?type=${type}`, {
          method: 'HEAD'
        });

        if (res.ok) {
          window.location.href = `http://localhost:3001/download-report?type=${type}`;
        } else {
          const label = type === 'load-time' ? 'Load Time' : 'Status Code';
          setDownloadError(`${label} report not found. Run the check first to generate it.`);
        }
      } catch {
        setDownloadError('Could not reach the server. Make sure the backend is running.');
      }
    };

    // ---------------- RESTART SERVER ----------------
    // Calls /restart-server — backend responds then calls process.exit(0).
    // The start.bat / start.sh wrapper detects the exit and relaunches node server.js.
    // UI polls /health every second until the server is back up, then shows "Back online".
    const handleRestartServer = async () => {
      setServerRestartStatus('restarting');
      try {
        await axios.post('http://localhost:3001/restart-server');
      } catch {
        // Expected — server shuts down before response fully arrives, axios may throw
      }

      // Poll until server is back
      const poll = setInterval(async () => {
        try {
          await axios.get('http://localhost:3001/');
          clearInterval(poll);
          setServerRestartStatus('done');
          setTimeout(() => setServerRestartStatus(''), 3000);
        } catch {
          // Still restarting — keep polling
        }
      }, 1000);
    };

    // ---------------- RESTART FRONTEND ----------------
    // Calls /restart-frontend — backend kills the old React process and spawns a fresh one.
    // React dev server takes ~5–10s to compile. UI shows status feedback.
    const handleRestartFrontend = async () => {
      setFrontendRestartStatus('restarting');
      try {
        await axios.post('http://localhost:3001/restart-frontend');
        setFrontendRestartStatus('done');
        setTimeout(() => setFrontendRestartStatus(''), 4000);
      } catch {
        setFrontendRestartStatus('error');
        setTimeout(() => setFrontendRestartStatus(''), 4000);
      }
    };

    // ---------------- DEVICE MANAGEMENT ----------------
    const addDevice = () => {
      setDeviceError('');
      
      if (!newDevice.label.trim()) {
        setDeviceError('Device name is required');
        return;
      }
      if (!newDevice.width || !newDevice.height) {
        setDeviceError('Width and height are required');
        return;
      }
      if (viewports.length >= 5) {
        setDeviceError('Maximum 5 devices allowed');
        return;
      }
      if (viewports.some(v => v.label.toLowerCase() === newDevice.label.toLowerCase())) {
        setDeviceError('Device name already exists');
        return;
      }

      const width = parseInt(newDevice.width);
      const height = parseInt(newDevice.height);
      
      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        setDeviceError('Width and height must be positive numbers');
        return;
      }

      setViewports([...viewports, {
        label: newDevice.label.trim(),
        width,
        height,
        enabled: true
      }]);
      
      setNewDevice({ label: '', width: '', height: '' });
    };

    const removeDevice = (label) => {
      setViewports(viewports.filter(v => v.label !== label));
      setDeviceError('');
    };

    // ---------------- DELETE ----------------
    const deleteData = (type) => {
      setConfirmDialog({ open: true, type, mode: 'confirm', message: '' });
    };

    const handleDeleteConfirm = async () => {
      try {
        const res = await axios.post('http://localhost:3001/delete-data', {
          type: confirmDialog.type
        });

        if (res.data.status === 'success') {
          setConfirmDialog({
            open: true, type: confirmDialog.type, mode: 'success',
            message: confirmDialog.type === 'reference'
              ? 'Reference data deleted successfully'
              : 'Test data deleted successfully'
          });
        } else {
          setConfirmDialog({
            open: true, type: confirmDialog.type, mode: 'warning',
            message: confirmDialog.type === 'reference'
              ? 'Reference folder not found. Run Baseline first.'
              : 'Test folder not found. Run Test first.'
          });
        }
      } catch {
        setConfirmDialog({
          open: true, type: confirmDialog.type, mode: 'warning',
          message: 'Delete failed'
        });
      }
    };

    const closeDialog = () => {
      setConfirmDialog({ open: false, type: '', mode: 'confirm', message: '' });
    };

    // ---------------- RESTART STATUS LABEL ----------------
    const restartLabel = (status, name) => {
      if (status === 'restarting') return { text: `⏳ Restarting ${name}...`, color: '#ff9800' };
      if (status === 'done')       return { text: `✅ ${name} back online`, color: '#4caf50' };
      if (status === 'error')      return { text: `❌ ${name} restart failed`, color: 'red' };
      return null;
    };

    const serverLabel   = restartLabel(serverRestartStatus, 'Server');
    const frontendLabel = restartLabel(frontendRestartStatus, 'Frontend');

    // ---------------- UI ----------------
    return (
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.header}>
          <h1>🎨 Visual Testing Dashboard</h1>
          <p>Comprehensive testing and verification suite</p>
        </div>

        {/* NAVIGATION */}
        <div style={styles.navBar}>
          <button
            onClick={() => setActivePage('visual')}
            style={{
              ...styles.button,
              ...(activePage === 'visual' ? { ...styles.buttonPrimary } : { backgroundColor: '#ddd', color: '#333' })
            }}
          >
            📊 Visual Testing
          </button>
          <button
            onClick={() => setActivePage('broken-links')}
            style={{
              ...styles.button,
              ...(activePage === 'broken-links' ? { ...styles.buttonPrimary } : { backgroundColor: '#ddd', color: '#333' })
            }}
          >
            ✅ Page Verification
          </button>
        </div>

        {/* VISUAL TESTING */}
        {activePage === 'visual' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📊 Visual Testing Module</div>

            {/* DEVICE SELECTION */}
            <div style={styles.card}>
              <div style={styles.label}>📱 Select Devices ({selectedCount}/{viewports.length}) - Max 5</div>
              
              {/* DEVICE TOGGLES */}
              <div style={styles.deviceGrid}>
                {viewports.map((viewport) => (
                  <div
                    key={viewport.label}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      onClick={() => {
                        setViewports(viewports.map(v =>
                          v.label === viewport.label ? { ...v, enabled: !v.enabled } : v
                        ));
                      }}
                      style={{
                        ...styles.deviceToggle,
                        backgroundColor: viewport.enabled ? '#4caf50' : '#f0f0f0',
                        color: viewport.enabled ? '#fff' : '#666',
                        borderColor: viewport.enabled ? '#4caf50' : '#ddd',
                        cursor: 'pointer',
                        flex: 1,
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                        {viewport.label === 'phone' && '📱'}
                        {viewport.label === 'tablet' && '📱'}
                        {viewport.label === 'desktop' && '🖥️'}
                        {!['phone', 'tablet', 'desktop'].includes(viewport.label) && '⚙️'}
                      </div>
                      <div>{viewport.label.toUpperCase()}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                        {viewport.width}×{viewport.height}
                      </div>
                    </div>
                    {viewports.length > 3 && (
                      <button
                        onClick={() => removeDevice(viewport.label)}
                        style={{
                          ...styles.button,
                          backgroundColor: '#f44336',
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '11px',
                          marginRight: 0,
                          marginBottom: 0,
                          width: '100%'
                        }}
                      >
                        ❌ Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ADD DEVICE FORM */}
              {viewports.length < 5 && (
                <div style={{
                  backgroundColor: '#f0f8ff',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #b3d9ff',
                  marginTop: '15px'
                }}>
                  <div style={styles.label}>➕ Add Custom Device</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Device name (e.g., iPad)"
                      value={newDevice.label}
                      onChange={(e) => {
                        setNewDevice({ ...newDevice, label: e.target.value });
                        setDeviceError('');
                      }}
                      style={{
                        ...styles.selectDropdown,
                        flex: 1,
                        minWidth: '120px',
                        borderColor: deviceError ? '#f44336' : '#ddd'
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Width"
                      value={newDevice.width}
                      onChange={(e) => {
                        setNewDevice({ ...newDevice, width: e.target.value });
                        setDeviceError('');
                      }}
                      style={{
                        ...styles.selectDropdown,
                        width: '80px',
                        borderColor: deviceError ? '#f44336' : '#ddd'
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Height"
                      value={newDevice.height}
                      onChange={(e) => {
                        setNewDevice({ ...newDevice, height: e.target.value });
                        setDeviceError('');
                      }}
                      style={{
                        ...styles.selectDropdown,
                        width: '80px',
                        borderColor: deviceError ? '#f44336' : '#ddd'
                      }}
                    />
                    <button
                      onClick={addDevice}
                      style={{
                        ...styles.button,
                        ...styles.buttonPrimary,
                        marginRight: 0
                      }}
                    >
                      ➕ Add
                    </button>
                  </div>
                  {deviceError && (
                    <div style={{
                      ...styles.statusBadge,
                      ...styles.statusFail,
                      marginTop: '8px',
                      width: '100%',
                      textAlign: 'center'
                    }}>
                      ⚠️ {deviceError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BASELINE SECTION */}
            <div style={styles.card}>
              <div style={{ marginBottom: '10px' }}>
                <button
                  onClick={() => runTest('reference')}
                  disabled={selectedCount === 0 || activeAction === 'reference' || activeAction === 'test'}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: (selectedCount === 0 || activeAction === 'reference' || activeAction === 'test') ? 0.6 : 1,
                    cursor: (selectedCount === 0 || activeAction === 'reference' || activeAction === 'test') ? 'not-allowed' : 'pointer'
                  }}
                >
                  🚀 Run Baseline
                </button>
                <button
                  onClick={() => deleteData('reference')}
                  style={{ ...styles.button, ...styles.buttonDanger }}
                >
                  🗑️ Delete Baseline
                </button>
              </div>
              {activeAction === 'reference' && (
                <div style={{...styles.statusBadge, ...styles.statusRunning}}>⏳ Running Baseline...</div>
              )}
              {baselineCompleted && (
                <div style={{...styles.statusBadge, ...styles.statusPass}}>✅ Baseline Complete</div>
              )}
              {(activeAction === 'reference' || baselineCompleted) && (
                <div style={styles.progressContainer}>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${baselineProgress}%`,
                      background: 'linear-gradient(90deg, #4caf50 0%, #45a049 100%)'
                    }}>
                      {baselineProgress > 10 && `${baselineProgress}%`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TEST SECTION */}
            <div style={styles.card}>
              <div style={{ marginBottom: '10px' }}>
                <button
                  onClick={() => runTest('test')}
                  disabled={selectedCount === 0 || activeAction === 'reference' || activeAction === 'test'}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: (selectedCount === 0 || activeAction === 'reference' || activeAction === 'test') ? 0.6 : 1,
                    cursor: (selectedCount === 0 || activeAction === 'reference' || activeAction === 'test') ? 'not-allowed' : 'pointer'
                  }}
                >
                  🚀 Run Test
                </button>
                <button
                  onClick={() => window.open('http://localhost:3001/report/html_report/index.html')}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  📋 View Report
                </button>
                <button
                  onClick={() => deleteData('test')}
                  style={{ ...styles.button, ...styles.buttonDanger }}
                >
                  🗑️ Delete Test
                </button>
              </div>
              {activeAction === 'test' && (
                <div style={{...styles.statusBadge, ...styles.statusRunning}}>⏳ Running Test...</div>
              )}
              {testCompleted && (
                <div style={{...styles.statusBadge, ...styles.statusPass}}>✅ Test Complete</div>
              )}
              {(activeAction === 'test' || testCompleted) && (
                <div style={styles.progressContainer}>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${testProgress}%`,
                      background: 'linear-gradient(90deg, #2196f3 0%, #0b7dda 100%)'
                    }}>
                      {testProgress > 10 && `${testProgress}%`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LOGS */}
            {visualLogs.length > 0 && (
              <div style={styles.card}>
                <div style={styles.label}>📝 Logs ({visualLogs.length})</div>
                <div style={styles.logsContainer}>
                  {visualLogs.map((l, i) => <div key={i}>{l}</div>)}
                  <div ref={visualLogsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE VERIFICATION */}
        {activePage === 'broken-links' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>✅ Page Verification Module</div>

            {/* RUN CONTROLS */}
            <div style={styles.card}>
              <div style={styles.label}>📄 Select Test Script</div>
              <div style={{ marginBottom: '10px' }}>
                <select
                  value={selectedScript}
                  onChange={(e) => setSelectedScript(e.target.value)}
                  disabled={activeAction === 'broken-links'}
                  style={{
                    ...styles.selectDropdown,
                    opacity: activeAction === 'broken-links' ? 0.6 : 1,
                    cursor: activeAction === 'broken-links' ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">Select Script</option>
                  <option value="tests/loadTimeCheck.spec.ts">⏱️ Load Time Check</option>
                  <option value="tests/statusCodeCheck.spec.ts">📡 Status Code Check</option>
                </select>
                <button
                  onClick={runBrokenLinks}
                  disabled={!selectedScript || activeAction === 'broken-links'}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: (!selectedScript || activeAction === 'broken-links') ? 0.6 : 1,
                    cursor: (!selectedScript || activeAction === 'broken-links') ? 'not-allowed' : 'pointer'
                  }}
                >
                  🚀 Run
                </button>
                <select
                  value={exportReport}
                  onChange={(e) => handleExportReport(e.target.value)}
                  disabled={activeAction === 'broken-links'}
                  style={{
                    ...styles.selectDropdown,
                    opacity: activeAction === 'broken-links' ? 0.6 : 1,
                    cursor: activeAction === 'broken-links' ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">📊 Export Report</option>
                  <option value="load-time">⏱️ Load Time Report</option>
                  <option value="status-code">📡 Status Code Report</option>
                </select>
              </div>

              {downloadError && (
                <div style={{
                  ...styles.statusBadge,
                  ...styles.statusFail,
                  marginTop: '10px'
                }}>
                  ⚠️ {downloadError}
                </div>
              )}

              {activeAction === 'broken-links' && (
                <div style={{
                  ...styles.statusBadge,
                  ...styles.statusRunning,
                  marginTop: '10px'
                }}>
                  ⏳ {selectedScript.includes('statusCode') ? 'Status Code Check' : 'Load Time Check'} in progress...
                </div>
              )}
            </div>

            {/* PROGRESS */}
            {(activeAction === 'broken-links' || pageTestCompleted) && (
              <div style={styles.card}>
                <div style={styles.label}>📈 Progress</div>
                {activeAction === 'broken-links' && (
                  <div style={{...styles.statusBadge, ...styles.statusRunning, marginBottom: '15px'}}>
                    ⏳ {selectedScript.includes('statusCode') ? 'Status Code Check' : 'Load Time Check'} in progress...
                  </div>
                )}
                {pageTestCompleted && (
                  <div style={{...styles.statusBadge, ...(pageStatus === 'PASS' ? styles.statusPass : styles.statusFail), marginBottom: '15px'}}>
                    {pageStatus === 'PASS' ? '✅ Test Complete - PASS' : '❌ Test Complete - FAIL'}
                  </div>
                )}
                <div style={styles.progressBar}>
                  <div style={{
                    ...styles.progressFill,
                    width: `${pageProgress}%`,
                    background: pageStatus === 'FAIL'
                      ? 'linear-gradient(90deg, #f44336 0%, #d32f2f 100%)'
                      : 'linear-gradient(90deg, #4caf50 0%, #45a049 100%)'
                  }}>
                    {pageProgress > 10 && `${Math.round(pageProgress)}%`}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <div style={styles.progressText}>{Math.round(pageProgress)}%</div>
                </div>
              </div>
            )}

            {/* LOGS */}
            {pageLogs.length > 0 && (
              <div style={styles.card}>
                <div style={styles.label}>📝 Logs ({pageLogs.length})</div>
                <div style={styles.logsContainer}>
                  {pageLogs.map((l, i) => <div key={i}>{l}</div>)}
                  <div ref={pageLogsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* DELETE CONFIRMATION DIALOG */}
        {confirmDialog.open && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              maxWidth: '400px',
              width: '90%'
            }}>
              {confirmDialog.mode === 'confirm' ? (
                <>
                  <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
                    ⚠️ Confirm Delete
                  </h3>
                  <p style={{ marginBottom: '20px', color: '#666' }}>
                    Delete {confirmDialog.type} data? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={closeDialog}
                      style={{
                        ...styles.button,
                        backgroundColor: '#ddd',
                        color: '#333'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      style={{
                        ...styles.button,
                        ...styles.buttonDanger
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
                    {confirmDialog.mode === 'success' ? '✅ Success' : '⚠️ Notice'}
                  </h3>
                  <p style={{ marginBottom: '20px', color: '#666' }}>
                    {confirmDialog.message}
                  </p>
                  <button
                    onClick={closeDialog}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      width: '100%'
                    }}
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  export default App;