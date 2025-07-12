import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { initializeApp } from 'firebase/app';

import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';



// --- Firebase Configuration ---

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-baccarat-app';



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

    const [customSystems, setCustomSystems] = useState([

        { name: 'สูตรของฉัน', steps: [10, 20, 40, 80, 160] }

    ]);

    const [isCustomSystemModalOpen, setIsCustomSystemModalOpen] = useState(false);

    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    const [newSystemName, setNewSystemName] = useState('');

    const [newSystemSteps, setNewSystemSteps] = useState('');



    // --- Prediction State for "Fluctuating Wave" ---

    const [waveMode, setWaveMode] = useState('INIT'); // INIT, RIDING, CUTTING, STORM_DODGE

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

                    } else {

                        await signInAnonymously(firebaseAuth);

                    }

                    setIsAuthReady(true);

                });

            } catch (error) {

                console.error("Firebase initialization error:", error);

                setIsLoading(false);

            }

        } else {

            console.log("Firebase config not found, running in local mode.");

            setIsLoading(false);

        }

    }, []);



    // --- Firestore Data Synchronization ---

    useEffect(() => {

        if (isAuthReady && db && userId) {

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

        }

    }, [isAuthReady, db, userId]);

    

    // --- Function to save state to Firestore ---

    const saveStateToFirestore = useCallback(async (newState) => {

        if (isAuthReady && db && userId) {

            try {

                const docRef = doc(db, 'artifacts', appId, 'users', userId, 'baccaratTracker', 'gameState');

                await setDoc(docRef, newState, { merge: true });

            } catch (error) {

                console.error("Error saving state to Firestore:", error);

            }

        }

    }, [isAuthReady, db, userId]);



    // --- Memoized Calculations for Performance ---

    const { prediction, nextBet } = useMemo(() => {

        // Prediction Logic

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



        // Money Management Logic

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

                    const fib = (n) => n <= 1 ? 1 : fib(n - 1) + fib(n - 2);

                    const findFibIndex = (val) => { let i = 1; while(fib(i) * baseUnit < val) i++; return i; };

                    let lastIndex = findFibIndex(lastBetAmount);

                    calculatedBet = lastPrediction.predictionResult === 'loss' ? fib(lastIndex + 1) * baseUnit : fib(Math.max(1, lastIndex - 2)) * baseUnit;

                    break;

                case 'parlay':

                    calculatedBet = lastPrediction.predictionResult === 'win' ? lastBetAmount + baseUnit : baseUnit;

                    break;

                default: // Custom system

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

        const relevantHistory = history.filter(h => h.predictionResult === 'win' || h.predictionResult === 'loss');



        for (const item of history) {

            if (item.predictionResult === 'win') {

                // Assuming Banker win pays 0.95 commission

                const winAmount = item.prediction === 'B' ? item.betAmount * 0.95 : item.betAmount;

                profit += winAmount;

            } else if (item.predictionResult === 'loss') {

                profit -= item.betAmount;

            }

        }



        for (const item of relevantHistory) {

            if (item.predictionResult === 'win') {

                win++; winStreak++; lossStreak = 0;

                if (winStreak > maxWinStreak) maxWinStreak = winStreak;

            } else if (item.predictionResult === 'loss') {

                loss++; lossStreak++; winStreak = 0;

                if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;

            }

        }

        return { stats: { win, loss, winStreak, lossStreak, maxWinStreak, maxLossStreak }, totalProfit: profit };

    }, [history]);



    const handleAddResult = (result) => {

        const currentState = { waveMode, consecutiveLosses, preTieWaveMode };

        let newWaveMode = currentState.waveMode;

        let newConsecutiveLosses = currentState.consecutiveLosses;

        let newPreTieWaveMode = currentState.preTieWaveMode;

        let predictionResult = 'skip';



        if (newWaveMode === 'STORM_DODGE') {

            newWaveMode = newPreTieWaveMode;

            predictionResult = 'skip';

        } else if (prediction.side !== 'รอผลตาแรก' && prediction.side !== 'ข้าม') {

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



        const newHistoryEntry = {

            result,

            prediction: prediction.side,

            predictionResult,

            betAmount: (predictionResult === 'skip' || predictionResult === 'tie') ? 0 : nextBet,

            timestamp: Date.now(),

            previousState: currentState // Store state for undo

        };

        

        const newFullState = {

            history: [...history, newHistoryEntry],

            waveMode: newWaveMode,

            preTieWaveMode: newPreTieWaveMode,

            consecutiveLosses: newConsecutiveLosses

        };



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

        

        saveStateToFirestore({

            history: newHistory,

            waveMode: previousState.waveMode,

            consecutiveLosses: previousState.consecutiveLosses,

            preTieWaveMode: previousState.preTieWaveMode,

        });

    };



    const confirmReset = () => {

        const initialState = {

            history: [],

            waveMode: 'INIT',

            preTieWaveMode: 'RIDING',

            consecutiveLosses: 0

        };

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

        if (!isNaN(value) && value > 0) {

            setBaseUnit(value);

            saveStateToFirestore({ baseUnit: value });

        } else if (e.target.value === '') {

            setBaseUnit(0);

        }

    };

    

    const ResultIcon = ({ result }) => {

        const baseClass = "w-5 h-5 rounded-full text-white flex items-center justify-center font-bold text-xs";

        switch (result) {

            case 'win': return <div className={`${baseClass} bg-green-500`}>✔</div>;

            case 'loss': return <div className={`${baseClass} bg-red-500`}>✘</div>;

            case 'tie': return <div className={`${baseClass} bg-gray-400`}>-</div>;

            default: return <div className="w-5 h-5"></div>;

        }

    };



    if (isLoading) {

        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">กำลังโหลดข้อมูล...</div>;

    }



    return (

        <div className="min-h-screen bg-gray-800 text-white font-sans p-4 md:p-6">

            <div className="max-w-7xl mx-auto">

                <header className="text-center mb-6">

                    <h1 className="text-3xl md:text-4xl font-bold text-yellow-300">Baccarat Tracker & Predictor</h1>

                    <p className="text-gray-400">บันทึกสถิติ ทำนายผล และบริหารเงินทุน</p>

                    {userId && <p className="text-xs text-gray-500 mt-1">UserID: {userId}</p>}

                </header>



                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* --- Left Column: Controls & Stats --- */}

                    <div className="lg:col-span-1 bg-gray-900 p-6 rounded-2xl shadow-lg space-y-6">

                        <div>

                            <h2 className="text-xl font-semibold mb-3 text-yellow-400 border-b-2 border-gray-700 pb-2">บันทึกผล & ควบคุม</h2>

                            <div className="grid grid-cols-3 gap-3">

                                <button onClick={() => handleAddResult('P')} className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md">Player</button>

                                <button onClick={() => handleAddResult('B')} className="bg-red-600 hover:bg-red-700 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md">Banker</button>

                                <button onClick={() => handleAddResult('T')} className="bg-green-600 hover:bg-green-700 transition-all duration-200 text-white font-bold py-3 rounded-lg shadow-md">Tie</button>

                            </div>

                             <button onClick={handleUndo} disabled={history.length === 0} className="w-full mt-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-white font-bold py-2 rounded-lg">ย้อนกลับ (Undo)</button>

                        </div>



                        <div className="bg-gray-800 p-4 rounded-lg">

                            <h3 className="text-lg font-semibold text-center mb-3">คำทำนายรอบถัดไป</h3>

                            <div className="text-center">

                                <p className="text-5xl font-bold" style={{color: prediction.side === 'P' ? '#3b82f6' : prediction.side === 'B' ? '#ef4444' : '#a0aec0'}}>{prediction.side}</p>

                                <p className="text-sm text-gray-400">({prediction.reason})</p>

                                <p className="mt-4 text-2xl font-semibold text-yellow-300">{prediction.side !== 'ข้าม' && prediction.side !== 'รอผลตาแรก' ? `วางเดิมพัน: ${nextBet} หน่วย` : 'ไม่ต้องวางเดิมพัน'}</p>

                            </div>

                        </div>



                        <div className="space-y-4">

                             <div>

                                <label htmlFor="base-unit" className="block text-sm font-medium text-gray-300 mb-1">หน่วยเดิมพันเริ่มต้น</label>

                                <input id="base-unit" type="number" value={baseUnit} onChange={handleBaseUnitChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500" />

                            </div>

                            <div>

                                <label htmlFor="prediction-strategy" className="block text-sm font-medium text-gray-300 mb-1">สูตรทำนายผล</label>

                                <select id="prediction-strategy" value={predictionStrategy} onChange={e => {setPredictionStrategy(e.target.value); saveStateToFirestore({predictionStrategy: e.target.value})}} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500">

                                    <option value="fluctuatingWave">สูตรคลื่นผันผวน</option>

                                </select>

                            </div>

                            <div>

                                <label htmlFor="money-system" className="block text-sm font-medium text-gray-300 mb-1">ระบบเดินเงิน</label>

                                <select id="money-system" value={moneySystem} onChange={e => {setMoneySystem(e.target.value); saveStateToFirestore({moneySystem: e.target.value})}} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500">

                                    <option value="martingale">Martingale (ทบเมื่อแพ้)</option>

                                    <option value="grandMartingale">Grand Martingale (ทบ+1หน่วย)</option>

                                    <option value="fibonacci">Fibonacci</option>

                                    <option value="parlay">Parlay (ทบเมื่อชนะ)</option>

                                    {customSystems.map(sys => <option key={sys.name} value={sys.name}>{sys.name}</option>)}

                                </select>

                            </div>

                             <div className="flex items-center space-x-2">

                                <button onClick={() => setIsCustomSystemModalOpen(true)} className="text-sm text-yellow-400 hover:text-yellow-300">+ เพิ่มสูตรเดินเงิน</button>

                             </div>

                        </div>



                        <div>

                            <h2 className="text-xl font-semibold mb-3 text-yellow-400 border-b-2 border-gray-700 pb-2">สถิติและผลประกอบการ</h2>

                            <div className="text-center text-2xl mb-3">

                                <span className="font-bold">กำไร/ขาดทุน: </span>

                                <span className={`font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit.toFixed(2)}</span>

                            </div>

                            <div className="space-y-2 text-gray-300">

                                <p>โหมดปัจจุบัน: <span className="font-bold text-white">{waveMode}</span></p>

                                <p>ชนะ/แพ้: <span className="font-bold text-green-400">{stats.win}</span> / <span className="font-bold text-red-400">{stats.loss}</span></p>

                                <p>ชนะติดต่อกัน (ปัจจุบัน): <span className="font-bold text-white">{stats.winStreak}</span> (สูงสุด: {stats.maxWinStreak})</p>

                                <p>แพ้ติดต่อกัน (ปัจจุบัน): <span className="font-bold text-white">{stats.lossStreak}</span> (สูงสุด: {stats.maxLossStreak})</p>

                            </div>

                        </div>



                        <div className="pt-4 border-t border-gray-700">

                            <button onClick={() => setIsResetModalOpen(true)} className="w-full bg-red-800 hover:bg-red-700 transition-colors text-white font-bold py-2 rounded-lg">ล้างข้อมูลทั้งหมด</button>

                        </div>

                    </div>



                    {/* --- Right Column: Bead Road --- */}

                    <div className="lg:col-span-2 bg-gray-900 p-6 rounded-2xl shadow-lg">

                        <h2 className="text-xl font-semibold mb-4 text-yellow-400">Bead Road (แสดงผลแนวตั้ง)</h2>

                        <div className="w-full h-[70vh] overflow-x-auto overflow-y-hidden bg-gray-800 p-4 rounded-lg">

                            {history.length === 0 ? (

                                <p className="text-center text-gray-500">ยังไม่มีข้อมูล... กรุณาบันทึกผล</p>

                            ) : (

                                <div className="grid grid-flow-col grid-rows-6 gap-3 h-full" style={{gridAutoColumns: 'minmax(60px, 1fr)'}}>

                                    {history.map((item, index) => {

                                        const color = item.result === 'P' ? 'bg-blue-500' : item.result === 'B' ? 'bg-red-500' : 'bg-green-500';

                                        return (

                                            <div key={item.timestamp} className="flex flex-col items-center justify-center space-y-1">

                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-lg ${color} relative`}>

                                                    {item.result}

                                                    <div className="absolute -top-1 -right-1">

                                                        <ResultIcon result={item.predictionResult} />

                                                    </div>

                                                </div>

                                                <span className="text-xs text-gray-400">#{index + 1}</span>

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

                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">

                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-4">

                        <h2 className="text-2xl font-bold text-yellow-300">สร้างสูตรเดินเงินใหม่</h2>

                        <div>

                            <label className="block text-sm font-medium text-gray-300 mb-1">ชื่อสูตร</label>

                            <input type="text" value={newSystemName} onChange={e => setNewSystemName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500" placeholder="เช่น สูตรเดินเงิน 5 ไม้" />

                        </div>

                        <div>

                            <label className="block text-sm font-medium text-gray-300 mb-1">ลำดับการเดินเงิน (คั่นด้วย ,)</label>

                            <input type="text" value={newSystemSteps} onChange={e => setNewSystemSteps(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500" placeholder="เช่น 10, 20, 45, 100, 225" />

                        </div>

                        <div className="flex justify-end space-x-4 pt-4">

                            <button onClick={() => setIsCustomSystemModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg">ยกเลิก</button>

                            <button onClick={handleSaveCustomSystem} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2 rounded-lg">บันทึก</button>

                        </div>

                    </div>

                </div>

            )}

            {isResetModalOpen && (

                 <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">

                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-4 text-center">

                        <h2 className="text-2xl font-bold text-red-500">ยืนยันการล้างข้อมูล</h2>

                        <p className="text-gray-300">คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสถิติทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้</p>

                        <div className="flex justify-center space-x-4 pt-4">

                            <button onClick={() => setIsResetModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg">ยกเลิก</button>

                            <button onClick={confirmReset} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-lg">ยืนยัน</button>

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

}