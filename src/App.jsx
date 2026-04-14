import { useState, useEffect, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Sun, Moon, Sunrise, Upload, Pill, X, Clock, Filter, AlarmClock, BellRing, CheckCircle2, History, FileText, CalendarDays, Activity, Droplet, HeartPulse } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

const playAlarmSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const playBeep = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      osc.start(time);
      osc.stop(time + duration);
    };
    
    const now = ctx.currentTime;
    
    playBeep(880, now, 0.2);
    playBeep(1100, now + 0.2, 0.4);
    playBeep(880, now + 0.6, 0.2);
    playBeep(1100, now + 0.8, 0.4);
  } catch {
    /* safely fallback */
  }
};

const computeMedicineStatus = (med, globalDurationDays, todayNormalized) => {
  if (!med.startDate || !globalDurationDays) return { isCompleted: false, daysLeft: null };
  const startNormalized = new Date(med.startDate).setHours(0,0,0,0);
  const daysDiff = Math.floor((todayNormalized - startNormalized) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > globalDurationDays - 1) {
    return { isCompleted: true, daysLeft: 0 };
  }
  return { isCompleted: false, daysLeft: globalDurationDays - daysDiff };
};

const getInitMedicines = () => {
  try { const s = localStorage.getItem('meditrack_data'); return s ? JSON.parse(s) : []; } catch { return []; }
};

const getInitSettings = () => {
  try {
    const s2 = localStorage.getItem('meditrack_settings_v2');
    if (s2) return JSON.parse(s2);
    const old = localStorage.getItem('meditrack_settings');
    if (old) {
      const p = JSON.parse(old);
      return { ...p, globalDurationDays: 7 };
    }
  } catch { /* safely ignore old parsing failures */ }
  return { morning: '08:00', afternoon: '13:00', night: '20:00', globalDurationDays: 7 };
};

const getInitFired = () => {
  try { const s = localStorage.getItem('meditrack_fired'); return s ? JSON.parse(s) : {}; } catch { return {}; }
};

const getInitPrescriptions = () => {
  try { 
    const s = localStorage.getItem('meditrack_prescription'); 
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && (parsed.image || parsed.consultationDate)) {
        return [{ id: crypto.randomUUID(), ...parsed }];
      }
    }
  } catch { /* empty */ }
  return []; 
};

// Modified Initializer: Transitioned from flat object to an Array Vault
const getInitTests = () => {
  try { 
    const s = localStorage.getItem('meditrack_tests'); 
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      // If user had existing flat data from the last test iteration, try pushing it securely into an array
      const keys = Object.keys(parsed);
      // Map arbitrary objects into historical array format if it was previously flat
      if (!Array.isArray(parsed) && keys.length > 0 && !keys.includes('testName')) {
         return []; // Flushed flat data due to array structure mismatch safely.
      }
    }
  } catch { /* empty */ }
  return [];
};


// Master Constants
const AVAILABLE_TESTS = [
  { name: 'Blood Sugar (Glucose)', icon: Droplet, color: '#ffb74d' },
  { name: 'HbA1c (Diabetes Test)', icon: Activity, color: '#ffb74d' },
  { name: 'Complete Blood Count (CBC)', icon: Droplet, color: '#ef5350' },
  { name: 'Lipid Profile (Cholesterol)', icon: HeartPulse, color: '#29b6f6' },
  { name: 'Thyroid Test (TSH)', icon: Activity, color: '#ab47bc' },
  { name: 'Liver Function Test (LFT)', icon: Activity, color: '#26a69a' },
  { name: 'Kidney Function Test (KFT)', icon: Activity, color: '#8d6e63' },
  { name: 'Urine Test', icon: Droplet, color: '#ffee58' },
  { name: 'ECG (Heart Test)', icon: HeartPulse, color: '#ff1744' },
  { name: 'X-Ray / Scan', icon: Activity, color: '#90a4ae' }
];

function App() {
  const [medicines, setMedicines] = useState(getInitMedicines);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isTestsOpen, setIsTestsOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState(null); 
  const [filter, setFilter] = useState('all'); 
  
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [image, setImage] = useState(null);
  const [timings, setTimings] = useState({ morning: false, afternoon: false, night: false });

  const [todayNormalized, setTodayNormalized] = useState(() => new Date().setHours(0,0,0,0));

  const [alarmSettings, setAlarmSettings] = useState(getInitSettings);
  const [lastFired, setLastFired] = useState(getInitFired);

  const [prescriptions, setPrescriptions] = useState(getInitPrescriptions);
  const [isAddingPrescription, setIsAddingPrescription] = useState(false);
  const [newPrescriptionData, setNewPrescriptionData] = useState({ image: null, consultationDate: '' });
  const [viewingImage, setViewingImage] = useState(null);

  // New Storage Arrays for Diagnostics Vault
  const [testRecords, setTestRecords] = useState(getInitTests);
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [newTestData, setNewTestData] = useState({ testName: AVAILABLE_TESTS[0].name, date: '', result: '', image: null });

  useEffect(() => { localStorage.setItem('meditrack_data', JSON.stringify(medicines)); }, [medicines]);
  useEffect(() => { localStorage.setItem('meditrack_settings_v2', JSON.stringify(alarmSettings)); }, [alarmSettings]);
  useEffect(() => { localStorage.setItem('meditrack_fired', JSON.stringify(lastFired)); }, [lastFired]);
  useEffect(() => { localStorage.setItem('meditrack_prescription', JSON.stringify(prescriptions)); }, [prescriptions]);
  useEffect(() => { localStorage.setItem('meditrack_tests', JSON.stringify(testRecords)); }, [testRecords]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTodayNormalized(now.setHours(0,0,0,0));

      if (activeAlarm) return;
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayDateStr = now.toDateString(); 

      const timesToCheck = ['morning', 'afternoon', 'night'];

      timesToCheck.forEach((timeBlock) => {
        const timeString = alarmSettings[timeBlock];
        if (currentHHMM === timeString && lastFired[timeBlock] !== todayDateStr) {
          
          const medsForBlock = medicines.filter(m => {
            if (!m.timings[timeBlock]) return false;
            
            if (m.startDate && alarmSettings.globalDurationDays) {
              const startN = new Date(m.startDate).setHours(0,0,0,0);
              const daysDiff = Math.floor((todayNormalized - startN) / (1000 * 60 * 60 * 24));
              if (daysDiff > alarmSettings.globalDurationDays - 1) return false;
            }
            return true;
          });
          
          if (medsForBlock.length > 0) {
            setActiveAlarm(timeBlock);
            playAlarmSound();
            setLastFired(prev => ({ ...prev, [timeBlock]: todayDateStr }));
          }
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [alarmSettings, lastFired, medicines, activeAlarm, todayNormalized]);

  const toggleTiming = (time) => setTimings(prev => ({ ...prev, [time]: !prev[time] }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) toast.error("Image too large for local storage!");
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePrescriptionImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error("Document too large! Keep under 2MB."); return; }
      const reader = new FileReader();
      reader.onloadend = () => setNewPrescriptionData(p => ({ ...p, image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const savePrescription = () => {
    if (!newPrescriptionData.image) { toast.error("Please upload an image document!"); return; }
    if (!newPrescriptionData.consultationDate) { toast.error("Please select a valid consultation date!"); return; }
    
    setPrescriptions(prev => [{ id: crypto.randomUUID(), ...newPrescriptionData }, ...prev]);
    toast.success("Document added safely to Vault!");
    setNewPrescriptionData({ image: null, consultationDate: '' });
    setIsAddingPrescription(false);
  };

  const deletePrescription = (id) => {
    setPrescriptions(prescriptions.filter(p => p.id !== id));
    toast.success("Document deleted.");
  };

  const saveTestRecord = () => {
    if (!newTestData.date) { toast.error("Please provide a valid test date."); return; }
    
    if (newTestData.testName === 'X-Ray / Scan') {
      if (!newTestData.image) { toast.error("Please explicitly upload your X-Ray/Scan image."); return; }
    } else {
      if (!newTestData.result.trim()) { toast.error("Please provide a valid record result."); return; }
    }

    setTestRecords(prev => [{ id: crypto.randomUUID(), ...newTestData }, ...prev]);
    toast.success("Medical record saved!");
    setNewTestData({ testName: AVAILABLE_TESTS[0].name, date: '', result: '', image: null });
    setIsAddingTest(false);
  };

  const handleTestImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error("Document too large! Keep under 2MB."); return; }
      const reader = new FileReader();
      reader.onloadend = () => setNewTestData(p => ({ ...p, image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const deleteTestRecord = (id) => {
    setTestRecords(testRecords.filter(r => r.id !== id));
    toast.success("Record deleted.");
  };

  const saveMedicine = () => {
    if (!name.trim()) return;
    if (!timings.morning && !timings.afternoon && !timings.night) {
      toast.error('Please select at least one dosage time!'); return;
    }

    const newMed = { 
      id: crypto.randomUUID(), 
      name: name.trim(), 
      purpose: purpose.trim(),
      image, 
      timings,
      startDate: new Date().toISOString()
    };
    setMedicines(prev => [...prev, newMed]);
    toast.success('Medicine schedule activated!');
    closeModal();
  };

  const deleteMedicine = (id) => {
    setMedicines(medicines.filter(m => m.id !== id));
    toast.success(`Medicine removed.`);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setName(''); setPurpose(''); setImage(null); 
      setTimings({ morning: false, afternoon: false, night: false });
    }, 300);
  };

  const filteredMedicines = useMemo(() => {
    if (filter === 'all') return medicines;
    return medicines.filter(med => med.timings[filter]);
  }, [medicines, filter]);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  return (
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '16px', background: 'rgba(30,30,40,0.9)', color: '#fff' } }} />
      
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>MediTrack</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Prescription tracking</motion.p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button 
            className="settings-btn" onClick={() => setIsTestsOpen(true)}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
            title="Medical Tests"
          >
            <Activity size={22} color="#00e676" />
          </motion.button>
          <motion.button 
            className="settings-btn" onClick={() => setIsPrescriptionOpen(true)}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
            title="Doctor's Prescription"
          >
            <FileText size={22} color="var(--primary-light)" />
          </motion.button>
          <motion.button 
            className="settings-btn" onClick={() => setIsSettingsOpen(true)}
            whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }}
            style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
            title="Alarm Settings"
          >
            <AlarmClock size={22} color="var(--primary-color)" />
          </motion.button>
        </div>
      </div>

      <motion.div className="filter-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        {['all', 'morning', 'afternoon', 'night'].map((f) => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'morning' && <Sunrise size={14} />}
            {f === 'afternoon' && <Sun size={14} />}
            {f === 'night' && <Moon size={14} />}
            {f === 'all' && <Filter size={14} />}
            <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
          </button>
        ))}
      </motion.div>

      <div className="content-scroll">
        <AnimatePresence mode="popLayout">
          {filteredMedicines.length === 0 ? (
            <motion.div key="empty" className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="empty-state-icon"><Clock size={48} strokeWidth={1} /></div>
              <h3>No Medicines Found</h3>
              <p>Add your first prescription schedule to begin tracking.</p>
            </motion.div>
          ) : (
            <motion.div key="list" className="medicines-grid" variants={containerVariants} initial="hidden" animate="show">
              <AnimatePresence>
                {filteredMedicines.map((med) => {
                  const status = computeMedicineStatus(med, alarmSettings.globalDurationDays, todayNormalized);
                  
                  return (
                  <motion.div 
                    key={med.id} className={`medicine-card ${status.isCompleted ? 'completed' : ''}`} layout variants={cardVariants}
                    initial="hidden" animate="show" exit="exit" whileHover={{ scale: 1.02 }}
                  >
                    {med.image ? <img src={med.image} alt={med.name} className="medicine-image" style={{ cursor: 'pointer' }} onClick={() => setViewingImage(med.image)} title="Click to expand" /> : <div className="medicine-placeholder"><Pill size={28} /></div>}
                    <div className="medicine-info">
                      <h3>{med.name}</h3>
                      {med.purpose && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', marginTop: '-4px' }}>For: {med.purpose}</p>}
                      <div className="timings-container">
                        {med.timings.morning && <span className="timing-badge morning"><Sunrise size={12}/> Morning</span>}
                        {med.timings.afternoon && <span className="timing-badge afternoon"><Sun size={12}/> Afternoon</span>}
                        {med.timings.night && <span className="timing-badge night"><Moon size={12}/> Night</span>}
                        
                        {status.isCompleted ? (
                          <span className="timing-badge completed">
                            Completed
                          </span>
                        ) : (
                           <span className="timing-badge duration">
                             {status.daysLeft} days left
                           </span>
                        )}
                      </div>
                    </div>
                    <button className="delete-btn" onClick={() => deleteMedicine(med.id)}><Trash2 size={18} /></button>
                  </motion.div>
                )})}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.button className="fab" onClick={() => setIsModalOpen(true)} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}>
        <Plus size={28} />
      </motion.button>

      {/* --- ADD MEDICINE MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div className="modal-overlay" onClick={closeModal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="modal-header"><h2>Add Medicine</h2><button className="close-btn" onClick={closeModal}><X size={20} /></button></div>

              <div className="input-group" style={{ marginBottom: '8px' }}>
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tablet Photo</span>
                  {image && <button style={{ color: '#EF5350', fontSize: '12px', fontWeight: 'bold' }} onClick={() => setImage(null)}>Remove</button>}
                </label>
              </div>

              <div className="upload-area" style={{ height: image ? '200px' : '140px', border: image ? 'none' : ''}}>
                {!image && <input type="file" accept="image/*" onChange={handleImageUpload} className="file-input" />}
                {image ? <img src={image} alt="Preview" className="preview-image" style={{ objectFit: 'contain', cursor: 'pointer' }} onClick={() => setViewingImage(image)} title="Click to view full screen" /> : <><div className="upload-icon"><Upload size={28} /></div><div className="upload-text">Tap to upload photo</div></>}
              </div>

              <div className="input-group">
                <label className="input-label">Tablet Name</label>
                <input type="text" className="text-input" placeholder="e.g. Vitamin C, Aspirin" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="input-group">
                <label className="input-label">Purpose of Medicine</label>
                <input type="text" className="text-input" placeholder="e.g. Blood Pressure, Immunity..." value={purpose} onChange={e => setPurpose(e.target.value)} />
              </div>

              <div className="input-group">
                <label className="input-label">Dosage Timing</label>
                <div className="timing-selector">
                  <motion.button whileTap={{ scale: 0.95 }} className={`timing-btn morning ${timings.morning ? 'active' : ''}`} onClick={() => toggleTiming('morning')}><div className="icon"><Sunrise /></div><div className="label">Morning</div></motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} className={`timing-btn afternoon ${timings.afternoon ? 'active' : ''}`} onClick={() => toggleTiming('afternoon')}><div className="icon"><Sun /></div><div className="label">Afternoon</div></motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} className={`timing-btn night ${timings.night ? 'active' : ''}`} onClick={() => toggleTiming('night')}><div className="icon"><Moon /></div><div className="label">Night</div></motion.button>
                </div>
              </div>

              <motion.button className="save-btn" onClick={saveMedicine} disabled={!name.trim() || (!timings.morning && !timings.afternoon && !timings.night)}>
                Save Schedule
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MEDICAL DIAGNOSTICS VAULT --- */}
      <AnimatePresence>
        {isTestsOpen && (
          <motion.div className="modal-overlay" onClick={() => setIsTestsOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
              
              {!isAddingTest ? (
                <>
                  <div className="modal-header"><h2>Medical Diagnostics</h2><button className="close-btn" onClick={() => setIsTestsOpen(false)}><X size={20} /></button></div>
                  
                  {testRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                       <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }}/>
                       <p>No historical records logged yet.</p>
                       <p style={{ fontSize: '12px' }}>Input your metrics to comprehensively track your health status over time.</p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                      <AnimatePresence>
                        {testRecords.map(record => {
                          const conf = AVAILABLE_TESTS.find(t => t.name === record.testName) || AVAILABLE_TESTS[0];
                          const IconComp = conf.icon;
                          return (
                          <motion.div key={record.id} className="prescription-card" style={{ padding: '16px' }} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginRight: '16px' }}>
                              <IconComp size={24} color={conf.color} />
                            </div>
                            <div className="prescription-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <h4 style={{ margin: 0 }}>{record.testName}</h4>
                              {record.testName === 'X-Ray / Scan' && record.image ? (
                                <img 
                                  src={record.image} 
                                  alt="X-Ray Scan" 
                                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px', marginBottom: '8px', cursor: 'pointer' }} 
                                  onClick={() => setViewingImage(record.image)}
                                  title="Click to expand"
                                />
                              ) : (
                                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{record.result}</span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>•</span>
                                <input 
                                  type="date"
                                  className="vault-date-edit"
                                  value={record.date}
                                  onChange={(e) => setTestRecords(prev => prev.map(item => item.id === record.id ? { ...item, date: e.target.value } : item))}
                                />
                              </div>
                            </div>
                            <button className="delete-btn" onClick={() => deleteTestRecord(record.id)}><Trash2 size={18} /></button>
                          </motion.div>
                        )})}
                      </AnimatePresence>
                    </div>
                  )}

                  <motion.button className="add-outset-btn" whileTap={{ scale: 0.95 }} onClick={() => setIsAddingTest(true)}>
                    <Plus size={20}/> Add Record
                  </motion.button>
                </>
              ) : (
                <>
                  <div className="modal-header"><h2>New Record</h2><button className="close-btn" onClick={() => setIsAddingTest(false)}><X size={20} /></button></div>
                  
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary-light)'}}><Activity size={16}/> Diagnostic Test Selection</label>
                    <select 
                      className="text-input" 
                      style={{ colorScheme: 'dark', cursor: 'pointer' }}
                      value={newTestData.testName} 
                      onChange={e => setNewTestData(p => ({ ...p, testName: e.target.value }))}
                    >
                      {AVAILABLE_TESTS.map(t => <option key={t.name} value={t.name} style={{ background: '#1e1e28', color: '#ffffff' }}>{t.name}</option>)}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary-light)'}}><CalendarDays size={16}/> Test Date</label>
                    <input 
                      type="date" className="text-input" 
                      style={{ colorScheme: 'dark' }} 
                      value={newTestData.date} 
                      onChange={e => setNewTestData(p => ({ ...p, date: e.target.value }))} 
                    />
                  </div>

                  {newTestData.testName === 'X-Ray / Scan' ? (
                    <div className="input-group">
                      <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><FileText size={16}/> Upload X-Ray / Scan Image</span>
                        {newTestData.image && (
                          <button style={{ color: '#EF5350', fontSize: '12px', fontWeight: 'bold' }} onClick={() => setNewTestData(p => ({ ...p, image: null }))}>Remove</button>
                        )}
                      </label>
                      <div className="upload-area" style={{ height: newTestData.image ? '200px' : '140px', border: newTestData.image ? 'none' : ''}}>
                        {!newTestData.image && <input type="file" accept="image/*" onChange={handleTestImageUpload} className="file-input" />}
                        {newTestData.image ? (
                          <img src={newTestData.image} alt="X-Ray Scan" className="preview-image" style={{ objectFit: 'contain', cursor: 'pointer' }} onClick={() => setViewingImage(newTestData.image)} title="Click to view full screen" />
                        ) : (
                          <><div className="upload-icon"><Upload size={28} /></div><div className="upload-text">Tap to attach Scan document</div></>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="input-group">
                      <label className="input-label" style={{ color: 'var(--primary-light)'}}><FileText size={16}/> Record Results</label>
                      <input 
                        type="text" className="text-input" 
                        placeholder="e.g. 90 mg/dL (Normal)"
                        value={newTestData.result} 
                        onChange={e => setNewTestData(p => ({ ...p, result: e.target.value }))} 
                      />
                    </div>
                  )}

                  <motion.button className="save-btn" onClick={saveTestRecord}>Save Record</motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DOCTOR'S PRESCRIPTION VAULT MODAL --- */}
      <AnimatePresence>
        {isPrescriptionOpen && (
          <motion.div className="modal-overlay" onClick={() => setIsPrescriptionOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
              
              {!isAddingPrescription ? (
                <>
                  <div className="modal-header"><h2>Doctor's Prescription</h2><button className="close-btn" onClick={() => setIsPrescriptionOpen(false)}><X size={20} /></button></div>
                  
                  {prescriptions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                       <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }}/>
                       <p>No documents uploaded yet.</p>
                       <p style={{ fontSize: '12px' }}>Keep all your written prescriptions safely logged here.</p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                      <AnimatePresence>
                        {prescriptions.map(p => (
                          <motion.div key={p.id} className="prescription-card" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <img 
                               src={p.image} 
                               alt="Prescription" 
                               className="prescription-thumbnail" 
                               onClick={() => setViewingImage(p.image)}
                               title="Click to expand"
                            />
                            <div className="prescription-info" style={{ display: 'flex', flexDirection: 'column' }}>
                              <h4>Consultation Date</h4>
                              <input 
                                type="date"
                                className="vault-date-edit"
                                value={p.consultationDate}
                                onChange={(e) => setPrescriptions(prev => prev.map(item => item.id === p.id ? { ...item, consultationDate: e.target.value } : item))}
                              />
                            </div>
                            <button className="delete-btn" onClick={() => deletePrescription(p.id)}><Trash2 size={18} /></button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  <motion.button className="add-outset-btn" whileTap={{ scale: 0.95 }} onClick={() => setIsAddingPrescription(true)}>
                    <Plus size={20}/> Add Document
                  </motion.button>
                </>
              ) : (
                <>
                  <div className="modal-header"><h2>New Document</h2><button className="close-btn" onClick={() => setIsAddingPrescription(false)}><X size={20} /></button></div>
                  
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary-light)'}}><CalendarDays size={16}/> Consultation Date</label>
                    <input 
                      type="date" className="text-input" 
                      style={{ colorScheme: 'dark' }} 
                      value={newPrescriptionData.consultationDate} 
                      onChange={e => setNewPrescriptionData(p => ({ ...p, consultationDate: e.target.value }))} 
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><FileText size={16}/> Upload Photo</span>
                      {newPrescriptionData.image && (
                        <button style={{ color: '#EF5350', fontSize: '12px', fontWeight: 'bold' }} onClick={() => setNewPrescriptionData(p => ({ ...p, image: null }))}>Remove</button>
                      )}
                    </label>
                    <div className="upload-area" style={{ height: newPrescriptionData.image ? '200px' : '140px', border: newPrescriptionData.image ? 'none' : ''}}>
                      {!newPrescriptionData.image && <input type="file" accept="image/*" onChange={handlePrescriptionImageUpload} className="file-input" />}
                      {newPrescriptionData.image ? (
                        <img src={newPrescriptionData.image} alt="Prescription" className="preview-image" style={{ objectFit: 'contain', cursor: 'pointer' }} onClick={() => setViewingImage(newPrescriptionData.image)} title="Click to view full screen" />
                      ) : (
                        <><div className="upload-icon"><Upload size={28} /></div><div className="upload-text">Tap to attach physical document</div></>
                      )}
                    </div>
                  </div>
                  
                  <motion.button className="save-btn" onClick={savePrescription}>Save to Vault</motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div className="modal-overlay" onClick={() => setIsSettingsOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
              <div className="modal-header"><h2>Alarm Settings</h2><button className="close-btn" onClick={() => setIsSettingsOpen(false)}><X size={20} /></button></div>
              
              <div className="input-group" style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                <label className="input-label" style={{ color: 'var(--primary-light)'}}><History size={16}/> Global Prescription Duration (Days)</label>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>This duration strictly applies to all medications on your schedule.</p>
                <input 
                  type="number" min="1" max="365" className="text-input" 
                  value={alarmSettings.globalDurationDays} 
                  onChange={e => setAlarmSettings(p => ({ ...p, globalDurationDays: parseInt(e.target.value) || 1 }))} 
                />
              </div>

              <div className="input-group">
                <label className="input-label"><Sunrise size={16}/> Morning Alarm</label>
                <input type="time" className="text-input" value={alarmSettings.morning} onChange={e => setAlarmSettings(p => ({ ...p, morning: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label"><Sun size={16}/> Afternoon Alarm</label>
                <input type="time" className="text-input" value={alarmSettings.afternoon} onChange={e => setAlarmSettings(p => ({ ...p, afternoon: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label"><Moon size={16}/> Night Alarm</label>
                <input type="time" className="text-input" value={alarmSettings.night} onChange={e => setAlarmSettings(p => ({ ...p, night: e.target.value }))} />
              </div>
              <motion.button className="save-btn" onClick={() => setIsSettingsOpen(false)}>Done</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeAlarm && (
          <motion.div className="modal-overlay" style={{ backdropFilter: 'blur(10px)', zIndex: 999 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '30px', textAlign: 'center', width: '90%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }} initial={{ scale: 0.8 }} animate={{ scale: [1, 1.05, 1], rotate: [0, -2, 2, 0], boxShadow: ["0px 0px 0px rgba(236,72,153,0)", "0px 0px 50px rgba(236,72,153,0.5)", "0px 0px 0px rgba(236,72,153,0)"] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <motion.div animate={{ rotate: [0, -15, 15, -15, 15, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} style={{ display: 'inline-block', color: 'var(--primary-color)', margin: '0 auto 16px' }}><BellRing size={64} /></motion.div>
              <h2 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 16px' }}>Time for your {activeAlarm} tablets!</h2>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', margin: '20px 0' }}>
                {medicines.filter(m => {
                  if (!m.timings[activeAlarm]) return false;
                  if (m.startDate && alarmSettings.globalDurationDays) {
                    const startN = new Date(m.startDate).setHours(0,0,0,0);
                    const daysDiff = Math.floor((todayNormalized - startN) / (1000 * 60 * 60 * 24));
                    if (daysDiff > alarmSettings.globalDurationDays - 1) return false;
                  }
                  return true;
                }).map(med => (
                  <div key={med.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
                      <CheckCircle2 size={20} color="var(--primary-color)" /> {med.name}
                    </div>
                    {med.purpose && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>For: {med.purpose}</div>}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setActiveAlarm(null)}
                style={{ background: 'var(--primary-color)', color: 'white', padding: '16px 32px', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', width: '100%', border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px rgba(236,72,153,0.3)' }}
              >I've taken them</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingImage && (
          <motion.div 
            className="lightbox-overlay" 
            onClick={() => setViewingImage(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <button className="close-btn" style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)' }} onClick={() => setViewingImage(null)}>
              <X size={24} color="#fff" />
            </button>
            <motion.img 
              src={viewingImage} 
              alt="Prescription Full" 
              className="lightbox-image"
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
