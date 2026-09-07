import { describe, it, expect } from 'vitest';
import { getEffectChips } from '../src/systems/ChoicePreview';
import { Choice } from '../src/types/game';

const choice = (over: Partial<Choice>): Choice => ({ id: 'c', text: 't', ...over });

describe('getEffectChips (D11/P7 colour cues)', () => {
  it('returns nothing for a choice with no effects', () => {
    expect(getEffectChips(choice({}))).toEqual([]);
  });

  it('marks a spend as a cost and an income as a gain', () => {
    const chips = getEffectChips(choice({
      description: 'x',
      effects: { grain: -10, guldmark: 15 },
    }));
    const grain = chips.find(c => c.key === 'grain');
    const coin = chips.find(c => c.key === 'guldmark');
    expect(grain).toMatchObject({ tone: 'cost', sign: '−', value: 10 });
    expect(coin).toMatchObject({ tone: 'gain', sign: '+', value: 15 });
  });

  it('suppresses the exact yield of a tier-estimated harvest', () => {
    const chips = getEffectChips(choice({
      description: 'Expect a fair harvest',
      resultKind: 'harvest',
      effects: { grain: 5, fatigue: 1 },
    }));
    expect(chips).toEqual([]); // the tier word carries it, not a number
  });

  it('suppresses the exact yield of felling but not its costs elsewhere', () => {
    const chips = getEffectChips(choice({
      description: 'Expect a heavy cut',
      resultKind: 'fell_timber',
      effects: { timber: 4, fatigue: 1 },
    }));
    expect(chips.find(c => c.key === 'timber')).toBeUndefined();
  });

  it('shows the buy-timber trade as coin out, timber in', () => {
    const chips = getEffectChips(choice({
      description: '5 guldmark for 2 timber',
      effects: { guldmark: -5, timber: 2 },
    }));
    expect(chips.find(c => c.key === 'guldmark')).toMatchObject({ tone: 'cost', value: 5 });
    expect(chips.find(c => c.key === 'timber')).toMatchObject({ tone: 'gain', value: 2 });
  });

  it('reads a renown gain as a gain', () => {
    const chips = getEffectChips(choice({ description: 'x', effects: { renown: 1 } }));
    expect(chips).toEqual([{ key: 'renown', icon: '⭐', sign: '+', value: 1, tone: 'gain' }]);
  });
});
