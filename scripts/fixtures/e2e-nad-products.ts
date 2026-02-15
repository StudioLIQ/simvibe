export type E2ERunMode = 'quick' | 'deep';

export interface E2ENadScenario {
  id: string;
  label: string;
  input: {
    tagline: string;
    description: string;
    pricingModel: 'free' | 'freemium' | 'subscription' | 'one_time' | 'usage_based' | 'custom';
    category: string;
    tags: string[];
    runMode: E2ERunMode;
    platformMode: 'nad_fun';
    pastedContent: string;
    nadFunSubmission: {
      tokenName: string;
      tokenSymbol: string;
      launchThesis: string;
      tokenNarrative: string;
      distributionPlan: string;
      riskAssumptions: string;
      antiSnipe: boolean;
      bundled: boolean;
    };
  };
}

const BASE_SCENARIOS: Omit<E2ENadScenario, 'id'>[] = [
  {
    label: 'Meme Culture Token',
    input: {
      tagline: 'The first meme-curated culture token on Monad',
      description: 'MonadMemes aggregates and rewards the best community memes. Holders vote on meme contests and top creators earn token rewards.',
      pricingModel: 'free',
      category: 'Meme',
      tags: ['Meme', 'Community', 'Monad', 'e2e:nad'],
      runMode: 'quick',
      platformMode: 'nad_fun',
      pastedContent: 'MonadMemes ($MMEME)\n\nThe first meme-curated culture token on Monad.\n\nMeme culture drives early adoption. MonadMemes captures that energy.',
      nadFunSubmission: {
        tokenName: 'MonadMemes',
        tokenSymbol: 'MMEME',
        launchThesis: 'Meme culture drives early adoption in every L1 ecosystem. MonadMemes captures that energy by tokenizing meme curation.',
        tokenNarrative: 'Every chain needs its culture layer. MonadMemes is the cultural heartbeat of Monad.',
        distributionPlan: 'Launch via nad.fun with anti-snipe. Seed 200 holders from Monad Discord. Weekly meme contests.',
        riskAssumptions: 'Meme tokens have high churn risk. No intrinsic utility beyond governance.',
        antiSnipe: true,
        bundled: false,
      },
    },
  },
  {
    label: 'DeFi Insurance Protocol',
    input: {
      tagline: 'Insurance protocol token for Monad DeFi positions',
      description: 'DeFi Shield provides on-chain insurance coverage for DeFi positions on Monad. Stakers earn yield from premiums.',
      pricingModel: 'custom',
      category: 'DeFi',
      tags: ['DeFi', 'Insurance', 'Monad', 'e2e:nad'],
      runMode: 'quick',
      platformMode: 'nad_fun',
      pastedContent: 'DeFi Shield ($DSHLD)\n\nInsurance coverage for Monad DeFi.\n\nAs Monad DeFi TVL grows, so does the need for native insurance.',
      nadFunSubmission: {
        tokenName: 'DeFi Shield',
        tokenSymbol: 'DSHLD',
        launchThesis: 'As Monad DeFi TVL grows, so does the need for native insurance. DeFi Shield is the first mover.',
        tokenNarrative: 'DeFi without insurance is gambling. DeFi Shield makes Monad the first chain where retail can protect positions natively.',
        distributionPlan: 'Partner with top 3 Monad DeFi protocols. Twitter Space with Monad core team. Early staker bonus.',
        riskAssumptions: 'Insurance pricing is hard to calibrate early. Smart contract risk in the insurance contract itself.',
        antiSnipe: true,
        bundled: true,
      },
    },
  },
  {
    label: 'Yield Aggregator',
    input: {
      tagline: 'Auto-compounding yield aggregator on Monad',
      description: 'YieldApes automates yield farming strategies across Monad DeFi. Hold YAPE to access premium vaults and vote on allocations.',
      pricingModel: 'freemium',
      category: 'DeFi',
      tags: ['DeFi', 'Yield', 'Monad', 'e2e:nad'],
      runMode: 'quick',
      platformMode: 'nad_fun',
      pastedContent: 'YieldApes ($YAPE)\n\nAuto-compounding yield on Monad.\n\nMonad speed enables more frequent compounding and lower gas.',
      nadFunSubmission: {
        tokenName: 'YieldApes',
        tokenSymbol: 'YAPE',
        launchThesis: 'Yield aggregation is a proven DeFi primitive. Monad speed enables more frequent compounding.',
        tokenNarrative: 'Apes together strong. YieldApes turns Monad speed into yield edge.',
        distributionPlan: 'Launch with 3 seed vaults on top Monad DEXs. Referral program. Degen vault for high-risk appetite.',
        riskAssumptions: 'Smart contract risk across multiple integrated protocols. Competition from established aggregators.',
        antiSnipe: true,
        bundled: true,
      },
    },
  },
];

export function buildE2ENadScenarios(
  count: number,
  runMode: E2ERunMode,
): E2ENadScenario[] {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 3;
  const scenarios: E2ENadScenario[] = [];

  for (let i = 0; i < safeCount; i++) {
    const base = BASE_SCENARIOS[i % BASE_SCENARIOS.length];
    const seq = i + 1;
    const cycle = Math.floor(i / BASE_SCENARIOS.length) + 1;
    const needsSuffix = safeCount > BASE_SCENARIOS.length;
    const suffix = needsSuffix ? ` ${cycle}` : '';
    const id = `${base.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${seq}`;

    scenarios.push({
      id,
      label: `${base.label}${suffix}`,
      input: {
        ...base.input,
        runMode,
        tagline: `${base.input.tagline}${needsSuffix ? ` (batch ${seq})` : ''}`,
        nadFunSubmission: {
          ...base.input.nadFunSubmission,
          tokenName: `${base.input.nadFunSubmission.tokenName}${suffix}`.slice(0, 100),
        },
      },
    });
  }

  return scenarios;
}
