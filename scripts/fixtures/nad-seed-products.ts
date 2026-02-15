export interface NadSeedProduct {
  slug: string;
  tokenName: string;
  tokenSymbol: string;
  tagline: string;
  description: string;
  launchThesis: string;
  tokenNarrative: string;
  distributionPlan: string;
  riskAssumptions: string;
  antiSnipe: boolean;
  bundled: boolean;
  pricingModel: 'free' | 'freemium' | 'subscription' | 'one_time' | 'usage_based' | 'custom';
  category: string;
  tags: string[];
  website?: string;
}

export const NAD_SEED_PRODUCTS: NadSeedProduct[] = [
  {
    slug: 'monad-memes',
    tokenName: 'MonadMemes',
    tokenSymbol: 'MMEME',
    tagline: 'The first meme-curated culture token on Monad',
    description:
      'MonadMemes aggregates and rewards the best community memes on Monad. Holders vote on meme contests, and top creators earn token rewards from a community treasury.',
    launchThesis:
      'Meme culture drives early adoption in every L1 ecosystem. MonadMemes captures that energy by tokenizing meme curation — turning attention into governance power.',
    tokenNarrative:
      'Every chain needs its culture layer. MonadMemes is the cultural heartbeat of Monad — where the best memes get rewarded and the community decides what is funny.',
    distributionPlan:
      'Launch via nad.fun with anti-snipe. Seed 200 holders from Monad Discord meme channel. KOL partnerships with 3 CT meme accounts. Weekly meme contest with token prizes.',
    riskAssumptions:
      'Meme tokens have high churn risk. No intrinsic utility beyond governance. Dependent on sustained community engagement. Vulnerable to copycat forks.',
    antiSnipe: true,
    bundled: false,
    pricingModel: 'free',
    category: 'Meme',
    tags: ['Meme', 'Community', 'Monad'],
  },
  {
    slug: 'defi-shield',
    tokenName: 'DeFi Shield',
    tokenSymbol: 'DSHLD',
    tagline: 'Insurance protocol token for Monad DeFi positions',
    description:
      'DeFi Shield provides on-chain insurance coverage for DeFi positions on Monad. Stakers earn yield from premiums while providing coverage against smart contract exploits and oracle failures.',
    launchThesis:
      'As Monad DeFi TVL grows, so does the need for native insurance. DeFi Shield is the first mover in Monad-native risk coverage, capturing premiums from a growing ecosystem.',
    tokenNarrative:
      'DeFi without insurance is gambling. DeFi Shield makes Monad the first chain where retail can protect positions natively — no bridges, no wrapping, just coverage.',
    distributionPlan:
      'Partner with top 3 Monad DeFi protocols for launch day coverage pools. Twitter Space with Monad core team. Early staker bonus for first 48 hours.',
    riskAssumptions:
      'Insurance pricing is hard to calibrate early. Low TVL initially means low premiums. Smart contract risk in the insurance contract itself. Regulatory gray area.',
    antiSnipe: true,
    bundled: true,
    pricingModel: 'custom',
    category: 'DeFi',
    tags: ['DeFi', 'Insurance', 'Monad'],
  },
  {
    slug: 'nad-names',
    tokenName: 'NadNames',
    tokenSymbol: 'NADN',
    tagline: 'Decentralized identity and naming service for Monad',
    description:
      'NadNames lets users register .nad domains linked to their Monad address. Token holders govern pricing, TLD policies, and integration partnerships.',
    launchThesis:
      'Every L1 needs a naming service. ENS proved the model on Ethereum. NadNames brings human-readable identities to Monad with native integration and community governance.',
    tokenNarrative:
      'Your identity on Monad starts with a name. NadNames is the ENS of Monad — but faster, cheaper, and governed by the community from day one.',
    distributionPlan:
      'Free .nad registration for first 1000 users. Integration with top Monad wallets at launch. Discord raid campaign targeting ENS power users dissatisfied with gas fees.',
    riskAssumptions:
      'Naming services are winner-take-all. If Monad ships an official naming service, NadNames loses. Low switching costs. Revenue depends on domain renewal rates.',
    antiSnipe: false,
    bundled: false,
    pricingModel: 'usage_based',
    category: 'Infrastructure',
    tags: ['Identity', 'Infrastructure', 'Monad'],
  },
  {
    slug: 'yield-apes',
    tokenName: 'YieldApes',
    tokenSymbol: 'YAPE',
    tagline: 'Auto-compounding yield aggregator token on Monad',
    description:
      'YieldApes automates yield farming strategies across Monad DeFi protocols. Hold YAPE to access premium vaults, vote on strategy allocations, and earn performance fees.',
    launchThesis:
      'Yield aggregation is a proven DeFi primitive. Monad speed enables more frequent compounding and lower gas per rebalance. YieldApes captures this structural advantage.',
    tokenNarrative:
      'Apes together strong. YieldApes turns Monad speed into yield edge — auto-compounding every block, not every hour. The fastest yield machine on the fastest chain.',
    distributionPlan:
      'Launch with 3 seed vaults on top Monad DEXs. Referral program: 5% of referred TVL as token bonus. Collab with Monad DeFi Twitter KOLs. Degen vault for high-risk appetite.',
    riskAssumptions:
      'Smart contract risk across multiple integrated protocols. Impermanent loss in LP vaults. Competition from established aggregators bridging to Monad. Regulatory risk on yield products.',
    antiSnipe: true,
    bundled: true,
    pricingModel: 'freemium',
    category: 'DeFi',
    tags: ['DeFi', 'Yield', 'Monad'],
  },
  {
    slug: 'monad-social',
    tokenName: 'MonadSocial',
    tokenSymbol: 'MSOC',
    tagline: 'Decentralized social graph token for the Monad ecosystem',
    description:
      'MonadSocial builds a portable social graph on Monad. Users mint follow relationships as on-chain attestations. Token holders curate the feed algorithm and earn from social data access.',
    launchThesis:
      'SocialFi is the next frontier after DeFi. Monad throughput enables on-chain social interactions at scale. MonadSocial captures the social graph before anyone else.',
    tokenNarrative:
      'Your followers, your data, your chain. MonadSocial puts social graphs on-chain where they belong — portable, composable, and owned by the community.',
    distributionPlan:
      'Airdrop to top 500 Monad ecosystem contributors. Integration with Farcaster and Lens for cross-chain social graph import. Launch event: follow-to-earn first 24 hours.',
    riskAssumptions:
      'SocialFi has historically low retention. Users may not value on-chain social graphs. High gas cost if attestation volume spikes. Privacy concerns with public social data.',
    antiSnipe: false,
    bundled: false,
    pricingModel: 'free',
    category: 'SocialFi',
    tags: ['SocialFi', 'Social', 'Monad'],
  },
  {
    slug: 'nft-launchpad',
    tokenName: 'NadLaunch',
    tokenSymbol: 'NLNCH',
    tagline: 'Fair-launch NFT launchpad powered by nad.fun mechanics',
    description:
      'NadLaunch provides a fair-launch NFT minting platform on Monad using bonding curves and anti-snipe protection. NLNCH holders get priority access and reduced fees.',
    launchThesis:
      'NFT launches on new chains are chaotic. NadLaunch brings nad.fun bonding curve fairness to NFT mints — transparent pricing, anti-bot protection, and community-first access.',
    tokenNarrative:
      'Fair mints for everyone. NadLaunch kills the bot problem in NFT launches — using the same bonding curve tech that makes nad.fun fair for tokens.',
    distributionPlan:
      'Partner with 5 Monad NFT artists for launch day collections. Twitter giveaway campaign. Early holder whitelist for first 3 collections. Discord community events.',
    riskAssumptions:
      'NFT market is cyclical and currently bearish. Launchpad value depends on quality projects choosing the platform. High competition from established launchpads expanding to Monad.',
    antiSnipe: true,
    bundled: false,
    pricingModel: 'usage_based',
    category: 'NFT',
    tags: ['NFT', 'Launchpad', 'Monad'],
  },
  {
    slug: 'monad-oracle',
    tokenName: 'NadOracle',
    tokenSymbol: 'NORC',
    tagline: 'Community-operated price oracle network for Monad DeFi',
    description:
      'NadOracle is a decentralized oracle network built natively for Monad. Node operators stake NORC to provide price feeds, earn rewards for accuracy, and get slashed for manipulation.',
    launchThesis:
      'Oracles are critical infrastructure. Chainlink dominance leaves room for chain-native alternatives optimized for Monad speed. NadOracle captures this niche with lower latency feeds.',
    tokenNarrative:
      'Monad deserves Monad-speed oracles. NadOracle delivers sub-second price feeds with native staking — faster, cheaper, and governed by the chain community.',
    distributionPlan:
      'Recruit 20 initial node operators from Monad validator community. Integration partnership with top 2 Monad DEXs. Bug bounty program funded by treasury.',
    riskAssumptions:
      'Oracle security is critical — any feed manipulation could cause massive losses. Competing with Chainlink brand trust. High technical barrier for node operation. Bootstrap chicken-and-egg problem.',
    antiSnipe: true,
    bundled: true,
    pricingModel: 'custom',
    category: 'Infrastructure',
    tags: ['Oracle', 'Infrastructure', 'Monad'],
  },
  {
    slug: 'degen-dao',
    tokenName: 'DegenDAO',
    tokenSymbol: 'DGDAO',
    tagline: 'Community-governed degen fund for early Monad tokens',
    description:
      'DegenDAO pools capital from community members to ape into early nad.fun launches. Token holders vote on allocations, and profits are distributed proportionally.',
    launchThesis:
      'Retail wants exposure to early-stage tokens but lacks the time and tools to evaluate launches. DegenDAO democratizes degen trading with collective intelligence and shared risk.',
    tokenNarrative:
      'Degen together. DegenDAO turns the chaos of early token launches into a community sport — vote, ape, profit, repeat. All on Monad, all transparent.',
    distributionPlan:
      'Launch on nad.fun with max community distribution. Weekly "Degen Picks" Twitter Space. Partnership with Monad alpha groups for deal flow. Meme campaign on CT.',
    riskAssumptions:
      'High risk of rug pulls in early tokens. Governance attacks if whale accumulation. Regulatory risk around pooled investment vehicles. Community fatigue if early picks underperform.',
    antiSnipe: false,
    bundled: true,
    pricingModel: 'free',
    category: 'DAO',
    tags: ['DAO', 'DeFi', 'Monad'],
  },
];
