import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-baccarat-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- SVG Icons ---
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;

// --- Main App Component ---
export default function App() {
    // --- Firebase State ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // --- Game State ---
    const [history, setHistory] = useState([]);
    const [predictionStrategy, setPredictionStrategy] = useState('fluctuatingWave');
    const [moneySystem, setMoneySystem] = useState('martingale');
    const [baseUnit, setBaseUnit] = useState(10);
    
    // --- Custom Money Systems ---
    const [customSystems, setCustomSystems] = useState([ { name: 'สูตรของฉัน', steps: [10, 20, 40, 80, 160] } ]);
    const [isCustomSystemModalOpen, setIsCustomSystemModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [newSystemName, setNewSystemName] = useState('');
    const [newSystemSteps, setNewSystemSteps] = useState('');

    // --- Prediction State ---
    const [waveMode, setWaveMode] = useState('INIT');
    const [preTieWaveMode, setPreTieWaveMode] = useState('RIDING');
    const [consecutiveLosses, setConsecutiveLosses] = useState(0);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
            try {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);
                setDb(firestoreDb);
                setAuth(firebaseAuth);

                onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsAuthReady(true);
                    } else if (initialAuthToken) {
                        try { await signInWithCustomToken(firebaseAuth, initialAuthToken); } 
                        catch (error) {
                            console.error("Error signing in with custom token, falling back to anonymous:", error);
                            await signInAnonymously(firebaseAuth);
                        }
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                });
            } catch (error) {
                console.error("Firebase initialization error:", error);
                setIsLoading(false);
            }
        } else {
            console.log("Firebase config not found, running in local mode.");
            setIsLoading(false);
            setIsAuthReady(true); 
            setUserId('local-user');
        }
    }, []);

    // --- Firestore Data Synchronization ---
    useEffect(() => {
        if (!isAuthReady || !db || !userId || userId === 'local-user') {
            if (userId === 'local-user') setIsLoading(false);
            return;
        }

        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'baccaratTracker', 'gameState');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setHistory(data.history || []);
                setPredictionStrategy(data.predictionStrategy || 'fluctuatingWave');
                setMoneySystem(data.moneySystem || 'martingale');
                setBaseUnit(data.baseUnit || 10);
                setCustomSystems(data.customSystems || [{ name: 'สูตรของฉัน', steps: [10, 20, 40, 80, 160] }]);
                setWaveMode(data.waveMode || 'INIT');
                setPreTieWaveMode(data.preTieWaveMode || 'RIDING');
                setConsecutiveLosses(data.consecutiveLosses || 0);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [isAuthReady, db, userId]);
    
    // --- Function to save state to Firestore ---
    const saveStateToFirestore = useCallback(async (newState) => {
        if (isAuthReady && db && userId && userId !== 'local-user') {
            try {
                const docRef = doc(db, 'artifacts', appId, 'users', userId, 'baccaratTracker', 'gameState');
                await setDoc(docRef, newState, { merge: true });
            } catch (error) {
                console.error("Error saving state to Firestore:", error);
            }
        }
    }, [isAuthReady, db, userId]);

    // --- Memoized Calculations ---
    const { prediction, nextBet } = useMemo(() => {
        let calculatedPrediction = { side: 'รอผลตาแรก', reason: 'เริ่มต้นเกม' };
        if (predictionStrategy === 'fluctuatingWave') {
            if (history.length === 0) {
                 calculatedPrediction = { side: 'รอผลตาแรก', reason: 'เริ่มต้น' };
            } else if (waveMode === 'STORM_DODGE') {
                calculatedPrediction = { side: 'ข้าม', reason: 'หลบพายุ (เสมอ)' };
            } else {
                const lastNonTieResult = [...history].reverse().find(h => h.result !== 'T')?.result;
                if (!lastNonTieResult) {
                    calculatedPrediction = { side: 'รอผล', reason: 'รอผลที่ไม่ใช่เสมอ' };
                } else if (waveMode === 'RIDING' || waveMode === 'INIT') {
                    calculatedPrediction = { side: lastNonTieResult, reason: 'ตามคลื่น' };
                } else if (waveMode === 'CUTTING') {
                    calculatedPrediction = { side: lastNonTieResult === 'P' ? 'B' : 'P', reason: 'ตัดคลื่น' };
                }
            }
        }

        let calculatedBet = baseUnit;
        const predictionHistory = history.filter(h => h.predictionResult === 'win' || h.predictionResult === 'loss');
        const lastPrediction = predictionHistory.length > 0 ? predictionHistory[predictionHistory.length - 1] : null;

        if (lastPrediction) {
            const lastBetAmount = lastPrediction.betAmount || baseUnit;
            switch (moneySystem) {
                case 'martingale':
                    calculatedBet = lastPrediction.predictionResult === 'loss' ? lastBetAmount * 2 : baseUnit;
                    break;
                case 'grandMartingale':
                    calculatedBet = lastPrediction.predictionResult === 'loss' ? (lastBetAmount * 2) + baseUnit : baseUnit;
                    break;
                case 'fibonacci':
                    const fib = (n) => {
                        let a = 1, b = 1;
                        if (n <= 2) return 1;
                        for (let i = 3; i <= n; i++) { let c = a + b; a = b; b = c; }
                        return b;
                    };
                    const findFibIndex = (val) => { let i = 1; while(fib(i) * baseUnit < val) i++; return i; };
                    let lastIndex = findFibIndex(lastBetAmount);
                    calculatedBet = lastPrediction.predictionResult === 'loss' ? fib(lastIndex + 1) * baseUnit : fib(Math.max(1, lastIndex - 2)) * baseUnit;
                    break;
                case 'parlay':
                    calculatedBet = lastPrediction.predictionResult === 'win' ? lastBetAmount + baseUnit : baseUnit;
                    break;
                default:
                    const system = customSystems.find(s => s.name === moneySystem);
                    if (system) {
                        if (lastPrediction.predictionResult === 'loss') {
                            const lastBetIndex = system.steps.indexOf(lastBetAmount);
                            calculatedBet = (lastBetIndex > -1 && lastBetIndex < system.steps.length - 1) ? system.steps[lastBetIndex + 1] : system.steps[0];
                        } else {
                            calculatedBet = system.steps[0];
                        }
                    } else {
                        calculatedBet = baseUnit;
                    }
            }
        }
        return { prediction: calculatedPrediction, nextBet: calculatedBet };
    }, [history, predictionStrategy, moneySystem, baseUnit, customSystems, waveMode]);

    const { stats, totalProfit } = useMemo(() => {
        let win = 0, loss = 0, winStreak = 0, lossStreak = 0, maxWinStreak = 0, maxLossStreak = 0, profit = 0;
        
        history.forEach(item => {
            if (item.predictionResult === 'win') {
                const winAmount = item.prediction === 'B' ? item.betAmount * 0.95 : item.betAmount;
                profit += winAmount;
            } else if (item.predictionResult === 'loss') {
                profit -= item.betAmount;
            }
        });

        const relevantHistory = history.filter(h => h.predictionResult === 'win' || h.predictionResult === 'loss');
        relevantHistory.forEach(item => {
            if (item.predictionResult === 'win') {
                win++; winStreak++; lossStreak = 0;
                if (winStreak > maxWinStreak) maxWinStreak = winStreak;
            } else if (item.predictionResult === 'loss') {
                loss++; lossStreak++; winStreak = 0;
                if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;
            }
        });
        return { stats: { win, loss, winStreak, lossStreak, maxWinStreak, maxLossStreak }, totalProfit: profit };
    }, [history]);

    // --- Event Handlers ---
    const handleAddResult = (result) => {
        const currentState = { waveMode, consecutiveLosses, preTieWaveMode };
        let newWaveMode = currentState.waveMode;
        let newConsecutiveLosses = currentState.consecutiveLosses;
        let newPreTieWaveMode = currentState.preTieWaveMode;
        let predictionResult = 'skip';

        if (newWaveMode === 'STORM_DODGE') {
            newWaveMode = newPreTieWaveMode;
        } else if (prediction.side !== 'รอผลตาแรก' && prediction.side !== 'ข้าม' && prediction.side !== 'รอผล') {
            if (prediction.side === result) {
                predictionResult = 'win';
                newConsecutiveLosses = 0;
            } else {
                predictionResult = 'loss';
                newConsecutiveLosses++;
            }
        }

        if (newConsecutiveLosses >= 2) {
            newWaveMode = (newWaveMode === 'RIDING' || newWaveMode === 'INIT') ? 'CUTTING' : 'RIDING';
            newConsecutiveLosses = 0;
        }
        
        if (result === 'T') {
            predictionResult = 'tie';
            newPreTieWaveMode = newWaveMode === 'INIT' ? 'RIDING' : newWaveMode;
            newWaveMode = 'STORM_DODGE';
        } else if (newWaveMode === 'INIT') {
             newWaveMode = 'RIDING';
        }

        const newHistoryEntry = { result, prediction: prediction.side, predictionResult, betAmount: (predictionResult === 'win' || predictionResult === 'loss') ? nextBet : 0, timestamp: Date.now(), previousState: currentState };
        const newFullState = { history: [...history, newHistoryEntry], waveMode: newWaveMode, preTieWaveMode: newPreTieWaveMode, consecutiveLosses: newConsecutiveLosses };

        setHistory(newFullState.history);
        setWaveMode(newFullState.waveMode);
        setPreTieWaveMode(newFullState.preTieWaveMode);
        setConsecutiveLosses(newFullState.consecutiveLosses);
        saveStateToFirestore(newFullState);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const lastEntry = history[history.length - 1];
        const previousState = lastEntry.previousState;
        const newHistory = history.slice(0, -1);

        setHistory(newHistory);
        setWaveMode(previousState.waveMode);
        setConsecutiveLosses(previousState.consecutiveLosses);
        setPreTieWaveMode(previousState.preTieWaveMode);
        saveStateToFirestore({ history: newHistory, ...previousState });
    };

    const confirmReset = () => {
        const initialState = { history: [], waveMode: 'INIT', preTieWaveMode: 'RIDING', consecutiveLosses: 0 };
        setHistory(initialState.history);
        setWaveMode(initialState.waveMode);
        setPreTieWaveMode(initialState.preTieWaveMode);
        setConsecutiveLosses(initialState.consecutiveLosses);
        saveStateToFirestore({ ...initialState, customSystems, baseUnit, moneySystem, predictionStrategy });
        setIsResetModalOpen(false);
    };

    const handleSaveCustomSystem = () => {
        if (newSystemName && newSystemSteps) {
            const stepsArray = newSystemSteps.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
            if (stepsArray.length > 0) {
                const newSystem = { name: newSystemName, steps: stepsArray };
                const updatedSystems = [...customSystems, newSystem];
                setCustomSystems(updatedSystems);
                saveStateToFirestore({ customSystems: updatedSystems });
                setIsCustomSystemModalOpen(false);
                setNewSystemName('');
                setNewSystemSteps('');
            }
        }
    };
    
    const handleBaseUnitChange = (e) => {
        const value = parseInt(e.target.value, 10);
        const newValue = isNaN(value) ? '' : value;
        setBaseUnit(newValue);
        if (newValue > 0) {
            saveStateToFirestore({ baseUnit: newValue });
        }
    };
    
    // --- Render Components ---
    const ResultIcon = ({ result }) => {
        const iconClass = "w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs border-2 border-brand-surface";
        switch (result) {
            case 'win': return <div className={`${iconClass} bg-brand-tie`}><CheckIcon /></div>;
            case 'loss': return <div className={`${iconClass} bg-brand-banker`}><XIcon /></div>;
            case 'tie': return <div className={`${iconClass} bg-gray-500`}><MinusIcon /></div>;
            default: return <div className="w-6 h-6"></div>;
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-brand-bg text-brand-text-primary flex items-center justify-center">กำลังโหลดข้อมูล...</div>;
    }

    const predictionColor = prediction.side === 'P' ? 'text-brand-player' : prediction.side === 'B' ? 'text-brand-banker' : 'text-brand-text-secondary';

    return (
        <div className="min-h-screen bg-brand-bg text-brand-text-primary font-sans p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-brand-primary">Baccarat Tracker</h1>
                    <p className="text-brand-text-secondary mt-1">บันทึกสถิติ ทำนายผล และบริหารเงินทุน</p>
                    {userId && <p className="text-xs text-gray-500 mt-2 opacity-50">UserID: {userId}</p>}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* --- Left Column: Controls & Stats --- */}
                    <div className="lg:col-span-1 bg-brand-surface p-6 rounded-2xl shadow-lg space-y-6 border border-brand-border">
                        <div className="bg-black/20 p-5 rounded-xl border border-brand-border animate-glow">
                            <h3 className="text-lg font-semibold text-center mb-2 text-brand-primary">คำทำนายรอบถัดไป</h3>
                            <div className="text-center">
                                <p className={`text-6xl font-bold ${predictionColor}`}>{prediction.side}</p>
                                <p className="text-sm text-brand-text-secondary h-4">({prediction.reason})</p>
                                <p className="mt-4 text-2xl font-semibold text-brand-secondary h-8">{prediction.side !== 'ข้าม' && prediction.side !== 'รอผลตาแรก' && prediction.side !== 'รอผล' ? `เดิมพัน: ${nextBet} หน่วย` : 'ไม่ต้องวางเดิมพัน'}</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold mb-3 text-brand-text-primary">บันทึกผล & ควบคุม</h2>
                            <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => handleAddResult('P')} className="bg-brand-player hover:bg-opacity-80 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md flex items-center justify-center">Player</button>
                                <button onClick={() => handleAddResult('B')} className="bg-brand-banker hover:bg-opacity-80 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md flex items-center justify-center">Banker</button>
                                <button onClick={() => handleAddResult('T')} className="bg-brand-tie hover:bg-opacity-80 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md flex items-center justify-center">Tie</button>
                            </div>
                             <button onClick={handleUndo} disabled={history.length === 0} className="w-full mt-3 bg-gray-600 hover:bg-gray-500 disabled:bg-brand-border disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2"><UndoIcon /> ย้อนกลับ</button>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-brand-border">
                            <h2 className="text-xl font-bold mb-3 text-brand-text-primary">ตั้งค่า</h2>
                             <div>
                                 <label htmlFor="base-unit" className="block text-sm font-medium text-brand-text-secondary mb-1">หน่วยเดิมพันเริ่มต้น</label>
                                 <input id="base-unit" type="number" value={baseUnit} onChange={handleBaseUnitChange} className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                             </div>
                             <div>
                                 <label htmlFor="money-system" className="block text-sm font-medium text-brand-text-secondary mb-1">ระบบเดินเงิน</label>
                                 <select id="money-system" value={moneySystem} onChange={e => {setMoneySystem(e.target.value); saveStateToFirestore({moneySystem: e.target.value})}} className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary">
                                     <option value="martingale">Martingale (ทบเมื่อแพ้)</option>
                                     <option value="grandMartingale">Grand Martingale (ทบ+1หน่วย)</option>
                                     <option value="fibonacci">Fibonacci</option>
                                     <option value="parlay">Parlay (ทบเมื่อชนะ)</option>
                                     {customSystems.map(sys => <option key={sys.name} value={sys.name}>{sys.name}</option>)}
                                 </select>
                             </div>
                             <button onClick={() => setIsCustomSystemModalOpen(true)} className="text-sm text-brand-primary hover:text-brand-primary-hover">+ เพิ่มสูตรเดินเงินเอง</button>
                        </div>

                        <div className="pt-4 border-t border-brand-border">
                             <h2 className="text-xl font-bold mb-3 text-brand-text-primary">สถิติและผลประกอบการ</h2>
                             <div className="text-center text-3xl mb-4">
                                 <span className="font-bold text-brand-text-secondary">กำไร/ขาดทุน: </span>
                                 <span className={`font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit.toFixed(2)}</span>
                             </div>
                             <div className="space-y-2 text-brand-text-secondary">
                                 <p className="flex justify-between">โหมดปัจจุบัน: <span className="font-bold text-white">{waveMode}</span></p>
                                 <p className="flex justify-between">ชนะ/แพ้: <span><span className="font-bold text-green-400">{stats.win}</span> / <span className="font-bold text-red-400">{stats.loss}</span></span></p>
                                 <p className="flex justify-between">ชนะติดต่อกัน (สูงสุด): <span>{stats.winStreak} ({stats.maxWinStreak})</span></p>
                                 <p className="flex justify-between">แพ้ติดต่อกัน (สูงสุด): <span>{stats.lossStreak} ({stats.maxLossStreak})</span></p>
                             </div>
                        </div>

                        <div className="pt-6 border-t border-brand-border">
                            <button onClick={() => setIsResetModalOpen(true)} className="w-full bg-red-800/80 hover:bg-red-700/80 transition-colors text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2"><TrashIcon /> ล้างข้อมูลทั้งหมด</button>
                        </div>
                    </div>

                    {/* --- Right Column: Bead Road --- */}
                    <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                        <h2 className="text-xl font-bold mb-4 text-brand-text-primary">Bead Road</h2>
                        <div className="w-full h-[75vh] overflow-x-auto overflow-y-hidden bg-brand-bg p-4 rounded-lg border border-brand-border bead-road-scroll">
                            {history.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center"><p className="text-center text-brand-text-secondary">ยังไม่มีข้อมูล... กรุณาบันทึกผล</p></div>
                            ) : (
                                <div className="grid grid-flow-col-dense grid-rows-6 gap-x-2 gap-y-3 h-full" style={{gridAutoColumns: 'minmax(65px, 1fr)'}}>
                                    {history.map((item, index) => {
                                        const color = item.result === 'P' ? 'bg-brand-player' : item.result === 'B' ? 'bg-brand-banker' : 'bg-brand-tie';
                                        return (
                                            <div key={item.timestamp} className="flex flex-col items-center justify-center space-y-1">
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-lg ${color} relative border-2 border-black/20`}>
                                                    {item.result}
                                                    <div className="absolute -top-2 -right-2">
                                                        <ResultIcon result={item.predictionResult} />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-brand-text-secondary opacity-70">#{index + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Modals --- */}
            {isCustomSystemModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-brand-surface p-8 rounded-lg shadow-xl w-full max-w-md space-y-4 border border-brand-border animate-scaleIn">
                        <h2 className="text-2xl font-bold text-brand-primary">สร้างสูตรเดินเงินใหม่</h2>
                        <div>
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">ชื่อสูตร</label>
                            <input type="text" value={newSystemName} onChange={e => setNewSystemName(e.target.value)} className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="เช่น สูตรเดินเงิน 5 ไม้" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">ลำดับการเดินเงิน (คั่นด้วย ,)</label>
                            <input type="text" value={newSystemSteps} onChange={e => setNewSystemSteps(e.target.value)} className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="เช่น 10, 20, 45, 100" />
                        </div>
                        <div className="flex justify-end space-x-4 pt-4">
                            <button onClick={() => setIsCustomSystemModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-semibold">ยกเลิก</button>
                            <button onClick={handleSaveCustomSystem} className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold px-4 py-2 rounded-lg">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
            {isResetModalOpen && (
                 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-brand-surface p-8 rounded-lg shadow-xl w-full max-w-md space-y-4 text-center border border-brand-border animate-scaleIn">
                        <h2 className="text-2xl font-bold text-red-500">ยืนยันการล้างข้อมูล</h2>
                        <p className="text-brand-text-secondary">คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสถิติทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
                        <div className="flex justify-center space-x-4 pt-4">
                            <button onClick={() => setIsResetModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg font-semibold">ยกเลิก</button>
                            <button onClick={confirmReset} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-lg">ยืนยัน</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
