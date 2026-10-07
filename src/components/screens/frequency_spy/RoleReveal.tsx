import { useGameStore } from '../../../lib/store';
import { Card, CardContent } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Radio, Crosshair } from 'lucide-react';

function SpectrumBar({ value, lowLabel, highLabel }: { value: number; lowLabel: string; highLabel: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-cyan-500/60 font-share-tech mb-2">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <div className="relative h-4 rounded-full bg-cyan-950/60 border border-cyan-800/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 via-cyan-500/20 to-cyan-900/20" />
        {/* tick marks */}
        {[25, 50, 75].map(t => (
          <div key={t} className="absolute top-0 bottom-0 w-px bg-cyan-800/30" style={{ left: `${t}%` }} />
        ))}
        {/* position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400 border-2 border-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-center mt-3">
        <div className="bg-cyan-900/30 border border-cyan-700/40 rounded-lg px-4 py-1.5">
          <span className="text-cyan-300 font-share-tech font-bold text-lg">{value}</span>
          <span className="text-cyan-500/60 text-xs font-share-tech ml-1">/ 100</span>
        </div>
      </div>
    </div>
  );
}

export default function RoleReveal() {
  const { myModeRoleId, myAssignedNumber, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedNumber: state.myAssignedNumber,
    myAssignedWord: state.myAssignedWord,       // stores the topic
    myAssignedCategory: state.myAssignedCategory, // stores "lowLabel|highLabel"
  }));

  const isSpy = myModeRoleId === 'frequency_spy';
  const topic = myAssignedWord ?? 'Unknown Topic';
  const [lowLabel, highLabel] = (myAssignedCategory ?? 'Low|High').split('|');

  return (
    <div className="w-full max-w-sm mx-auto animate-in fade-in zoom-in duration-700">
      <Card
        variant="glass"
        className="relative overflow-hidden border-cyan-800/40 bg-gradient-to-br from-cyan-950/60 to-base"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-700 via-cyan-400 to-cyan-700 opacity-70" />
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-400 to-transparent pointer-events-none" />

        <CardContent className="relative z-10 flex flex-col items-center text-center pt-8 pb-4">
          <Badge variant="info" className="mb-6 px-3 py-1 text-xs tracking-[0.2em] bg-cyan-900/50 border-cyan-700/40 text-cyan-200 font-share-tech">
            SIGNAL RECEIVED
          </Badge>

          <div className="mb-6 relative">
            <div className="absolute inset-0 blur-2xl opacity-25 bg-cyan-400 rounded-full animate-pulse" />
            <div className={`relative p-5 rounded-2xl border bg-elevated/60 ${isSpy ? 'border-red-700/40' : 'border-cyan-700/40'}`}>
              {isSpy ? <Crosshair size={48} className="text-red-400" /> : <Radio size={48} className="text-cyan-300" />}
            </div>
          </div>

          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-500/60 mb-1 font-share-tech">Identity</h2>
          <h1 className={`text-4xl md:text-5xl font-black mb-6 uppercase font-share-tech ${isSpy ? 'text-red-400' : 'text-cyan-300'}`}>
            {isSpy ? 'ROGUE' : 'OPERATIVE'}
          </h1>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent mb-6" />

          {/* Topic */}
          <div className="w-full bg-cyan-950/40 rounded-xl p-3 border border-cyan-800/30 mb-5 text-left">
            <p className="text-xs text-cyan-500/60 uppercase tracking-widest mb-1 font-share-tech">// TOPIC</p>
            <p className="text-lg font-bold text-cyan-100 font-share-tech">{topic}</p>
          </div>

          {/* Number on spectrum */}
          <div className="w-full bg-cyan-950/40 rounded-xl p-4 border border-cyan-800/30 mb-6">
            <p className="text-xs text-cyan-500/60 uppercase tracking-widest mb-3 font-share-tech">
              {isSpy ? '// YOUR SIGNAL (OFF-TARGET)' : '// YOUR SIGNAL'}
            </p>
            {myAssignedNumber !== null ? (
              <SpectrumBar value={myAssignedNumber} lowLabel={lowLabel} highLabel={highLabel} />
            ) : (
              <p className="text-cyan-500 font-share-tech">Loading...</p>
            )}
          </div>

          <p className="text-sm text-cyan-500/60 leading-relaxed font-share-tech">
            {isSpy
              ? '// your number differs. blend in with the group — don\'t reveal yourself.'
              : '// discuss the topic. your numbers should cluster. find the outlier.'}
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-cyan-600/40 mt-6 animate-pulse font-share-tech text-xs uppercase tracking-widest">
        // awaiting transmission...
      </p>
    </div>
  );
}
