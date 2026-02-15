#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage: node scripts/generate-personas.mjs <ticketsDir> [--write] [--force] [--limit N]',
      '',
      'Generates persona docs into `personas/<persona_id>.md` from ticket seeds.',
      'Also marks each ticket as done and fills completion notes.',
      '',
      'Options:',
      '  --write     Actually write files (default: true)',
      '  --force     Overwrite existing persona docs',
      '  --limit N   Only process first N tickets (useful for preview)',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = {
    ticketsDir: undefined,
    write: true,
    force: false,
    limit: undefined,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--help' || a === '-h') return { ...args, help: true };
    if (a === '--write') {
      args.write = true;
      continue;
    }
    if (a === '--no-write') {
      args.write = false;
      continue;
    }
    if (a === '--force') {
      args.force = true;
      continue;
    }
    if (a === '--limit') {
      const n = Number(argv[i + 1]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --limit: ${argv[i + 1]}`);
      args.limit = n;
      i += 1;
      continue;
    }
    positional.push(a);
  }

  args.ticketsDir = positional[0];
  return args;
}

function hashStringToUint32(input) {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeDashes(s) {
  return s.replaceAll('–', '-').replaceAll('—', '-');
}

function parseBudgetRange(raw) {
  const cleaned = normalizeDashes(raw).replaceAll(',', '').trim();
  const numbers = cleaned.match(/\d+/g);
  if (!numbers || numbers.length < 2) throw new Error(`Unable to parse budget range: "${raw}"`);
  return { min: Number(numbers[0]), max: Number(numbers[1]) };
}

function getPackTypeFromDirName(dirBase) {
  if (dirBase.includes('personas-everyday-low-exposure')) return 'everyday_low_exposure';
  if (dirBase.includes('personas-everyday')) return 'everyday';
  if (dirBase.includes('personas-low-exposure')) return 'low_exposure';
  if (dirBase.includes('personas-ph-grinders')) return 'ph_grinder';
  if (dirBase.includes('personas-elite')) return 'elite';
  if (dirBase === 'personas') return 'core';
  return 'core';
}

function inferCategory({ personaId, role, archetype }) {
  const hay = `${personaId} ${role} ${archetype}`.toLowerCase();
  const tokens = new Set(hay.split(/[^a-z0-9]+/).filter(Boolean));
  const hasToken = (...k) => k.some((x) => tokens.has(x));
  const hasSub = (...k) => k.some((x) => hay.includes(x));

  // Security / legal / compliance
  if (
    hasToken('ciso', 'security', 'privacy', 'gdpr', 'soc2', 'compliance', 'risk', 'legal', 'dpo', 'redteam') ||
    hasSub('soc 2', 'privacy counsel', 'data protection officer')
  ) return 'security';

  // IT / sysadmin
  if (hasToken('it', 'sysadmin', 'noc', 'network', 'sso', 'mdm', 'jamf') || hasSub('it admin', 'it administrator')) return 'it';

  // Recruiting / People Ops
  if (hasToken('recruiter', 'recruiting', 'talent', 'hr', 'hrbp') || hasSub('people ops', 'employer brand')) return 'people';

  // Support / CS / community
  if (
    hasToken('support', 'helpdesk', 'csm', 'community') ||
    hasSub('customer success', 'customer_success', 'support rep', 'support engineer')
  ) return 'support';

  // Sales / RevOps
  if (hasToken('sales', 'sdr', 'ae', 'revops') || hasSub('sales ops', 'account executive', 'sales enablement')) return 'sales';

  // Marketing / growth / comms
  if (hasToken('marketing', 'growth', 'seo', 'content', 'comms', 'influencer', 'brand') || hasSub('public relations')) return 'marketing';

  // Design / UX writing (but keep UX Engineer in engineering if present)
  if (hasToken('designer', 'ux', 'ui', 'writer') || hasSub('design ops', 'ux writer')) return 'design';

  // Product / PMM
  if (hasToken('product', 'pm', 'pmm') || hasSub('product ops', 'product operations')) return 'product';

  // Founders / investors
  if (hasToken('founder', 'vc', 'angel', 'investor') || hasSub('accelerator mentor', 'founder in residence')) return 'founder';

  // Finance
  if (hasToken('finance', 'controller', 'accountant', 'bookkeeper', 'cfo', 'billing') || hasSub('accounts payable', 'ap clerk')) return 'finance';

  // Data / analytics
  if (
    hasToken('analytics', 'sql', 'dbt', 'warehouse', 'bi', 'data', 'analyst') ||
    hasSub('data analyst', 'bi analyst', 'data science', 'ml engineer', 'machine learning', 'research scientist', 'recsys')
  ) return 'data';

  // Engineering (last, to avoid “data engineer” matching too early for data above)
  if (hasToken('engineer', 'developer', 'sre', 'devops', 'platform', 'backend', 'frontend', 'fullstack', 'ios', 'android', 'mobile', 'qa', 'embedded')) {
    return 'engineering';
  }

  return 'general';
}

const REGION_PRESETS = [
  {
    test: (name) => ['Kim', 'Cho', 'Park', 'Lee', 'Choi', 'Jung', 'Kang', 'Yoon'].includes(name),
    location: ['Seoul, South Korea (Hybrid)', 'Seongnam, South Korea (Hybrid)', 'Busan, South Korea (Remote)'],
    tz: 'KST',
    languages: 'Korean (native), English (fluent)',
  },
  {
    test: (name) => ['Tanaka', 'Sato', 'Suzuki', 'Watanabe', 'Ito', 'Yamamoto'].includes(name),
    location: ['Tokyo, Japan (Hybrid)', 'Osaka, Japan (Remote)'],
    tz: 'JST',
    languages: 'Japanese (native), English (professional)',
  },
  {
    test: (name) => ['Patel', 'Mehta', 'Singh', 'Shah', 'Nair', 'Desai', 'Kumar'].includes(name),
    location: ['Bengaluru, India (Hybrid)', 'Mumbai, India (Remote)', 'Pune, India (Hybrid)'],
    tz: 'IST',
    languages: 'English (fluent), Hindi (native)',
  },
  {
    test: (name) => ['Dubois', 'Laurent', 'Olivier', 'Moreau'].includes(name),
    location: ['Paris, France (Hybrid)', 'Lyon, France (Remote)'],
    tz: 'CET',
    languages: 'French (native), English (fluent)',
  },
  {
    test: (name) => ['Weber', 'Richter', 'Muller', 'Schmidt', 'Kraus'].includes(name),
    location: ['Berlin, Germany (Hybrid)', 'Munich, Germany (Hybrid)'],
    tz: 'CET',
    languages: 'German (native), English (fluent)',
  },
  {
    test: (name) => ['Ramirez', 'Morales', 'Herrera', 'Alvarez', 'Gomez', 'Santos', 'Martinez'].includes(name),
    location: ['Mexico City, Mexico (Hybrid)', 'Madrid, Spain (Remote)', 'Bogotá, Colombia (Remote)'],
    tz: 'CT',
    languages: 'Spanish (native), English (professional)',
  },
  {
    test: (name) => ['Olsen', 'Berg', 'Lind', 'Novak', 'Nowak'].includes(name),
    location: ['Stockholm, Sweden (Hybrid)', 'Oslo, Norway (Remote)', 'Warsaw, Poland (Hybrid)'],
    tz: 'CET',
    languages: 'English (fluent), local language (native)',
  },
  {
    test: (name) => ['Chen', 'Zhang', 'Li', 'Wang', 'Liu', 'Huang'].includes(name),
    location: ['Singapore (Hybrid)', 'Taipei, Taiwan (Hybrid)', 'Hong Kong (Hybrid)'],
    tz: 'SGT',
    languages: 'English (fluent), Mandarin (native)',
  },
];

function inferRegion(displayName, rng) {
  const parts = displayName.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.replaceAll(/[^\p{L}']/gu, '') ?? '';
  for (const preset of REGION_PRESETS) {
    if (preset.test(last)) {
      return {
        location: pick(rng, preset.location),
        tz: preset.tz,
        languages: preset.languages,
      };
    }
  }
  const usCity = pick(rng, ['San Francisco, CA, USA (Hybrid)', 'Austin, TX, USA (Remote)', 'New York, NY, USA (Hybrid)', 'Chicago, IL, USA (Hybrid)']);
  const tz = usCity.includes('New York') ? 'ET' : usCity.includes('Chicago') ? 'CT' : usCity.includes('Austin') ? 'CT' : 'PT';
  return { location: usCity, tz, languages: 'English (native)' };
}

function wordCount(s) {
  return s
    .replaceAll(/[`*_>#]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function deriveSeniority(role) {
  const r = role.toLowerCase();
  if (r.includes('intern')) return 'IC';
  if (r.includes('junior') || r.includes('new grad')) return 'IC';
  if (r.includes('lead') || r.includes('manager')) return 'Manager';
  if (r.includes('director')) return 'Director';
  if (r.includes('vp')) return 'VP';
  if (r.includes('chief') || r.includes('cio') || r.includes('ciso')) return 'VP';
  if (r.includes('founder')) return 'Founder';
  return 'IC';
}

function inferAge(role, rng) {
  const r = role.toLowerCase();
  let min = 28;
  let max = 40;
  if (r.includes('new grad') || r.includes('junior')) {
    min = 22; max = 28;
  } else if (r.includes('senior')) {
    min = 30; max = 42;
  } else if (r.includes('staff') || r.includes('principal')) {
    min = 32; max = 48;
  } else if (r.includes('lead') || r.includes('manager')) {
    min = 32; max = 46;
  } else if (r.includes('director') || r.includes('vp') || r.includes('cio') || r.includes('ciso')) {
    min = 38; max = 58;
  } else if (r.includes('prof') || r.includes('dr.')) {
    min = 40; max = 65;
  }
  return clampInt(min + rng() * (max - min), min, max);
}

function inferCompanyStage(role, rng) {
  const r = role.toLowerCase();
  if (r.includes('series a')) return 'Series A';
  if (r.includes('series b')) return 'Series B';
  if (r.includes('series c')) return 'Series C';
  if (r.includes('seed')) return 'Seed';
  if (r.includes('enterprise')) return 'Enterprise';
  if (r.includes('public')) return 'Public';
  if (r.includes('agency')) return 'Agency';
  if (r.includes('nonprofit')) return 'Nonprofit';
  if (r.includes('university')) return 'University';
  if (r.includes('hospital')) return 'Enterprise';
  return pick(rng, ['Seed', 'Series A', 'Series B', 'Enterprise']);
}

function inferCompanySize(stage, rng) {
  if (stage === 'Seed') return `${clampInt(10 + rng() * 25, 10, 40)} people`;
  if (stage === 'Series A') return `${clampInt(35 + rng() * 120, 35, 180)} people`;
  if (stage === 'Series B') return `${clampInt(120 + rng() * 380, 120, 500)} people`;
  if (stage === 'Series C') return `${clampInt(300 + rng() * 700, 300, 1000)} people`;
  if (stage === 'Agency') return `${clampInt(8 + rng() * 40, 8, 60)} people`;
  if (stage === 'Nonprofit') return `${clampInt(20 + rng() * 130, 20, 150)} people`;
  if (stage === 'University') return `2,000+ staff (IT org ~${clampInt(30 + rng() * 150, 30, 180)})`;
  if (stage === 'Public' || stage === 'Enterprise') return `${clampInt(2000 + rng() * 12000, 2000, 14000)}+ people`;
  return `${clampInt(50 + rng() * 300, 50, 350)} people`;
}

function inferIndustry(role) {
  const r = role.toLowerCase();
  if (r.includes('fintech') || r.includes('bank')) return 'Fintech / Banking';
  if (r.includes('healthcare') || r.includes('hipaa') || r.includes('hospital')) return 'Healthcare';
  if (r.includes('ecommerce') || r.includes('d2c') || r.includes('shopify')) return 'E-commerce';
  if (r.includes('gaming') || r.includes('game')) return 'Gaming';
  if (r.includes('edtech') || r.includes('school') || r.includes('university')) return 'Education';
  if (r.includes('nonprofit')) return 'Nonprofit';
  if (r.includes('b2b saas') || r.includes('saas')) return 'B2B SaaS';
  return 'B2B SaaS';
}

function inferEmploymentStatus(role) {
  const r = role.toLowerCase();
  if (r.includes('founder')) return 'Founder';
  if (r.includes('freelance') || r.includes('contractor')) return 'Freelancer';
  if (r.includes('student')) return 'Student';
  return 'Employed';
}

function inferMonthlyIncomeUSD(category, seniority, stage, rng) {
  // Rough ranges only; keeps everything explicit for persona docs.
  const base = {
    engineering: [8000, 20000],
    security: [9000, 22000],
    product: [7000, 18000],
    design: [6000, 16000],
    marketing: [5000, 15000],
    sales: [5000, 20000],
    support: [3500, 9000],
    people: [4500, 12000],
    finance: [6000, 18000],
    it: [5500, 16000],
    data: [6500, 19000],
    founder: [0, 25000],
    general: [4500, 14000],
  }[category] ?? [4500, 14000];

  let [min, max] = base;
  if (seniority === 'Director' || seniority === 'VP') { min *= 1.4; max *= 1.6; }
  if (seniority === 'Manager') { min *= 1.15; max *= 1.25; }
  if (stage === 'Seed') { min *= 0.9; max *= 1.0; }
  if (stage === 'Enterprise' || stage === 'Public') { min *= 1.1; max *= 1.25; }
  if (category === 'sales') { max *= 1.4; }
  if (category === 'founder') {
    // Founders vary wildly.
    min = rng() < 0.5 ? 0 : 3000;
    max = 25000;
  }

  const lo = clampInt(min + rng() * (max - min) * 0.4, 0, 40000);
  const hi = clampInt(lo + 1000 + rng() * (max - min) * 0.6, lo + 1000, 45000);
  return { min: lo, max: hi };
}

function toolsFor(category, rng) {
  const base = ['Slack', 'Google Workspace', 'Notion', 'Zoom', 'Chrome'];
  const presets = {
    engineering: [
      'GitHub', 'VS Code', 'Linear', 'Jira', 'Datadog', 'Postman', 'Docker', 'AWS',
    ],
    security: [
      'Okta', 'Google Admin', 'Jira', 'Confluence', 'Snyk', 'Wiz', 'Cloudflare', 'AWS',
    ],
    product: [
      'Figma', 'Linear', 'Notion', 'GA4', 'Amplitude', 'Hotjar', 'Slack',
    ],
    design: [
      'Figma', 'FigJam', 'Notion', 'Slack', 'Zeroheight', 'Loom',
    ],
    marketing: [
      'HubSpot', 'GA4', 'Webflow', 'Ahrefs', 'Mailchimp', 'Google Ads', 'Meta Ads Manager',
    ],
    sales: [
      'Salesforce', 'HubSpot', 'Gong', 'Outreach', 'LinkedIn Sales Navigator', 'Google Sheets',
    ],
    support: [
      'Zendesk', 'Intercom', 'Jira', 'Confluence', 'Slack', 'Loom',
    ],
    people: [
      'Greenhouse', 'Lever', 'Google Calendar', 'Slack', 'Notion', 'Zoom',
    ],
    finance: [
      'QuickBooks', 'NetSuite', 'Stripe', 'Bill.com', 'Excel', 'Google Sheets',
    ],
    it: [
      'Okta', 'Jamf', 'Google Admin', 'Intune', 'ServiceNow', 'Slack',
    ],
    data: [
      'BigQuery', 'Snowflake', 'Looker', 'Mode', 'dbt', 'Metabase', 'Google Sheets',
    ],
    founder: [
      'Stripe', 'Notion', 'Linear', 'Slack', 'Figma', 'Webflow',
    ],
    general: ['Google Sheets', 'Notion', 'Slack', 'Asana', 'Trello'],
  };

  const extras = presets[category] ?? presets.general;
  const chosen = new Set(base);
  while (chosen.size < 8) chosen.add(pick(rng, extras));
  return Array.from(chosen);
}

function alternativesFor(category, rng) {
  const presets = {
    engineering: ['GitHub Copilot', 'ChatGPT', 'Cursor', 'Sentry', 'Datadog'],
    security: ['Vanta', 'Drata', 'Wiz', 'Snyk', 'Okta'],
    product: ['Notion', 'Linear', 'Intercom', 'Amplitude', 'Mixpanel'],
    design: ['Figma', 'Framer', 'Webflow', 'Canva', 'LottieFiles'],
    marketing: ['HubSpot', 'Mailchimp', 'GA4', 'Ahrefs', 'Hootsuite'],
    sales: ['Salesforce', 'HubSpot', 'Apollo', 'Outreach', 'Gong'],
    support: ['Zendesk', 'Intercom', 'Freshdesk', 'Help Scout', 'Jira'],
    people: ['Greenhouse', 'Lever', 'Workday', 'BambooHR', 'Calendly'],
    finance: ['QuickBooks', 'Xero', 'NetSuite', 'Stripe', 'Ramp'],
    it: ['Okta', 'Jamf', 'Intune', 'ServiceNow', 'Google Admin'],
    data: ['Looker', 'Tableau', 'Metabase', 'dbt', 'Mode'],
    founder: ['Notion', 'Trello', 'Webflow', 'Stripe', 'Airtable'],
    general: ['Google Sheets', 'Notion', 'Airtable', 'Zapier', 'Calendly'],
  };
  const pool = presets[category] ?? presets.general;
  const picked = new Set();
  while (picked.size < 5) picked.add(pick(rng, pool));
  return Array.from(picked);
}

function packLaunchBehavior(pack) {
  if (pack === 'ph_grinder') {
    return {
      why: 'status, curiosity, and finding “the next big thing” to share',
      attention: '10 seconds for card, 2–4 minutes on landing (plus comments)',
      click: ['Trending rank', 'Big logos or investor name-dropping', 'Polished hero + punchy tagline', 'Lots of GIFs/screenshots', 'Clear “LAUNCHED TODAY” urgency'],
      commentStyle: 'performative, hype-forward, occasionally asks superficial questions',
      upvote: ['Founder story', 'Strong social proof (logos, “#1 Product of the Day”)', 'AI-flavored buzzwords that feel current', 'Nice visuals and microcopy', 'Public roadmap / “we’re shipping fast” energy'],
      bounce: ['No obvious social proof', 'Boring visuals', 'Long technical docs up front', 'Pricing feels “enterprise”', 'Signup friction (email verification, long forms)'],
      proof: { susceptibility: 'High', what: 'badges, logos, influencer quotes, and “ships fast” signals' },
    };
  }
  if (pack === 'low_exposure') {
    return {
      why: 'rarely; usually only when a colleague links something relevant',
      attention: '5–8 minutes max if there’s real buying intent',
      click: ['Clear “for X” positioning', 'One hard proof point', 'Screenshot of workflow', 'Transparent pricing', 'Fast “how it works”'],
      commentStyle: 'mostly silent; may send a private note internally instead',
      upvote: ['Practical value', 'Integration clarity', 'No sales-gating'],
      bounce: ['Vague claims', 'Sales-only CTA', 'Long onboarding', 'Missing docs/security info', 'Anything that looks risky'],
      proof: { susceptibility: 'Low', what: 'benchmarks, docs, security posture, or trusted peer endorsement' },
    };
  }
  if (pack === 'everyday_low_exposure') {
    return {
      why: 'almost never; discovers tools via coworkers or manager asks',
      attention: '30–90 seconds unless it looks instantly useful',
      click: ['“Saves me time today” promise', 'Simple screenshots', 'Clear pricing', 'No setup complexity'],
      commentStyle: 'silent',
      upvote: ['Feels easy', 'Free tier', 'Looks trustworthy'],
      bounce: ['Too many steps', 'Confusing jargon', 'No examples', 'Looks like it will create more work', 'Any hint of data risk'],
      proof: { susceptibility: 'Medium', what: 'screenshots, simple testimonials, “used by teams like yours”' },
    };
  }
  if (pack === 'everyday') {
    return {
      why: 'occasionally for lightweight research or curiosity',
      attention: '10 seconds for card, ~60 seconds on landing',
      click: ['Clear headline', 'Workflow screenshots', 'Price under $50/mo', 'Simple setup', 'Looks like it reduces busywork'],
      commentStyle: 'rarely comments; if they do it’s a short practical question',
      upvote: ['Clear time savings', 'Friendly UI', 'Honest pricing'],
      bounce: ['Hard-to-understand copy', 'No screenshots', 'Hidden pricing', 'Anything that seems risky with customer data', 'Sales call required'],
      proof: { susceptibility: 'Medium', what: 'screenshots, practical demos, and a few believable testimonials' },
    };
  }
  if (pack === 'elite') {
    return {
      why: 'to find leverage—tools that compound productivity or distribution',
      attention: '2–5 minutes on landing + deeper dive if signal is strong',
      click: ['Novel capability', 'Clear differentiated claim', 'Impressive proof (case study, benchmark)', 'Tasteful design', 'Fast demo/video'],
      commentStyle: 'direct, constructive, sometimes challenging',
      upvote: ['Distinct advantage', 'Obvious craft', 'Strong founder/credibility signals', 'Clear pricing/value alignment'],
      bounce: ['Commodity positioning', 'Sloppy UX', 'Hand-wavy claims', 'No proof', 'Sales-gated basics'],
      proof: { susceptibility: 'Medium', what: 'credible case studies, benchmarks, reputable endorsements' },
    };
  }
  // core
  return {
    why: 'research and curiosity (sometimes buying intent)',
    attention: '10 seconds for card, 1–2 minutes on landing',
    click: ['Clear ICP', 'Proof (benchmarks/testimonials)', 'Screenshots', 'Pricing clarity', 'Obvious differentiator'],
    commentStyle: 'inquisitive or skeptical, depending on the claim',
    upvote: ['Strong value prop', 'Credible proof', 'Good UX', 'No dark patterns'],
    bounce: ['Buzzword soup', 'No proof', 'Hidden pricing', 'Long onboarding', 'Sketchy data practices'],
    proof: { susceptibility: 'Medium', what: 'credible logos, benchmarks, and real workflow demos' },
  };
}

function enrichFromAnchors(anchors) {
  const text = anchors.join(' ').toLowerCase();
  const signals = new Set();
  const add = (k) => signals.add(k);
  if (text.includes('soc 2') || text.includes('soc2') || text.includes('iso')) add('security_cert');
  if (text.includes('sso') || text.includes('saml')) add('sso');
  if (text.includes('rbac') || text.includes('audit')) add('audit');
  if (text.includes('docs') || text.includes('api')) add('docs');
  if (text.includes('screenshots') || text.includes('gif')) add('screenshots');
  if (text.includes('pricing')) add('pricing');
  if (text.includes('trial') || text.includes('self-serve') || text.includes('self serve') || text.includes('demo')) add('self_serve');
  if (text.includes('jargon')) add('no_jargon');
  if (text.includes('template') || text.includes('examples')) add('templates');
  if (text.includes('book a call') || text.includes('call')) add('no_call');
  if (text.includes('onboarding') || text.includes('setup')) add('fast_setup');
  if (text.includes('ai')) add('ai_skeptic');
  return signals;
}

function makePrioritiesAndRedFlags(category, seed, anchors) {
  const signals = enrichFromAnchors(anchors);

  const base = {
    engineering: {
      priorities: [
        'Clear technical explanation (what it does, limits, failure modes)',
        'Easy integration with existing stack (API/SDK/webhooks)',
        'Security/privacy posture and sensible data minimization',
        'Fast setup and low maintenance burden',
        'Docs, examples, and observable behavior (logs, metrics)',
      ],
      redFlags: [
        'Vague “AI” claims without specifics or benchmarks',
        'No docs/API reference or unclear integration steps',
        'Requests source code/production logs without strong guarantees',
        'Sales-only gatekeeping for basic evaluation',
        'Long onboarding or unclear rollback path',
      ],
    },
    security: {
      priorities: [
        'Security posture (SOC 2/ISO, DPA, subprocessors, retention)',
        'SSO/SAML, RBAC, and audit logs',
        'Data handling clarity (what is stored, where, for how long)',
        'Least-privilege integration and safe defaults',
        'Vendor transparency and incident readiness',
      ],
      redFlags: [
        'No clear security documentation or compliance posture',
        'Vague retention/subprocessor story',
        'No SSO/RBAC/audit logs for “team” product',
        'Over-collection of sensitive data',
        'Misleading claims or evasive answers',
      ],
    },
    product: {
      priorities: [
        'Clear ICP and value proposition',
        'Onboarding flow and time-to-value',
        'Workflow fit and adoption friction',
        'Evidence of outcomes (case studies, metrics)',
        'Pricing clarity and upgrade path',
      ],
      redFlags: [
        'Unclear “for everyone” positioning',
        'Buzzword-heavy copy with no concrete examples',
        'No onboarding path or unclear setup',
        'Hidden pricing or sales-gated basics',
        'No believable proof',
      ],
    },
    design: {
      priorities: [
        'Quality and taste of the UI (defaults, typography, spacing)',
        'Real workflow examples and templates',
        'Export formats and handoff friendliness',
        'Speed and stability (no jank)',
        'Collaboration/feedback loops',
      ],
      redFlags: [
        'Clunky UI or obvious UX papercuts',
        'No examples/templates (blank-canvas trap)',
        'Export limitations or proprietary lock-in',
        'Inconsistent design language',
        'Overpromising with no demo',
      ],
    },
    marketing: {
      priorities: [
        'Hook strength and positioning clarity',
        'Conversion impact and measurable uplift',
        'Fast iteration (A/B tests, landing edits)',
        'Attribution/analytics compatibility',
        'Credible proof (case studies, before/after)',
      ],
      redFlags: [
        'Generic headline with no differentiated claim',
        'No clear CTA or too many CTAs',
        'Unmeasurable promises (“10x growth”)',
        'Slow or messy landing experience',
        'Weak or fake-looking social proof',
      ],
    },
    sales: {
      priorities: [
        'Workflow fit with CRM and existing sequencing',
        'Quality of leads/insights (not spammy)',
        'Time saved per rep and team adoption ease',
        'Compliance/deliverability and data safety',
        'Pricing per seat and scaling clarity',
      ],
      redFlags: [
        'No CRM integration story',
        'Anything that risks deliverability/reputation',
        'Hidden pricing or “talk to sales” only',
        'Overpromising with no proof',
        'Messy onboarding and low control',
      ],
    },
    support: {
      priorities: [
        'Reduces ticket handle time without reducing quality',
        'Clear workflow screenshots and simple onboarding',
        'Integrates with ticketing/knowledge base tools',
        'Safe handling of customer data (minimize PII)',
        'Quick wins (macros, templates, suggested replies)',
      ],
      redFlags: [
        'Confusing setup or requires training time',
        'Requires uploading customer PII/screenshots',
        'No visible workflow or product screenshots',
        'Vague promises with no proof',
        'Can’t explain how it keeps data safe',
      ],
    },
    people: {
      priorities: [
        'Saves scheduling/admin time immediately',
        'Candidate experience and professionalism',
        'Privacy/compliance with candidate data',
        'Integrations with ATS/calendar',
        'Clear permissions and auditability',
      ],
      redFlags: [
        'No ATS/calendar integration',
        'Privacy posture unclear',
        'Too many manual steps/config',
        'No role/permission controls',
        'Sales-only for basic eval',
      ],
    },
    finance: {
      priorities: [
        'Accuracy and auditability',
        'Exports (CSV) and clean integrations',
        'Approval flows and access controls',
        'Predictable pricing and clear billing',
        'Reliable support and documentation',
      ],
      redFlags: [
        'No export/audit trail',
        'Hidden fees or confusing billing',
        'Risky data handling',
        'Sync issues without clear reconciliation',
        'No role-based access',
      ],
    },
    it: {
      priorities: [
        'SSO/SCIM and centralized admin controls',
        'Least-privilege permissions and secure defaults',
        'Easy rollout and supportability',
        'Vendor security docs and responsiveness',
        'Integration with existing IT stack',
      ],
      redFlags: [
        'No SSO/SCIM for team product',
        'Requires admin credentials without clear scope',
        'No security documentation',
        'Hard to roll back / uninstall',
        'Opaque data collection',
      ],
    },
    data: {
      priorities: [
        'Correctness and explainability of metrics',
        'Secure connections and credential handling',
        'Templates/examples that reduce ambiguity',
        'Exports and interoperability',
        'Clear assumptions and caveats',
      ],
      redFlags: [
        'Black-box outputs with no assumptions stated',
        'Requires warehouse credentials without safeguards',
        'Jargon-heavy docs with no examples',
        'No schema/lineage clarity',
        'Hidden pricing or usage surprises',
      ],
    },
    founder: {
      priorities: [
        'Fast time-to-value (days, not weeks)',
        'Clear differentiation and defensibility',
        'Distribution leverage (channels, virality, partnerships)',
        'Pricing that matches value and scales',
        'Evidence of real adoption',
      ],
      redFlags: [
        'No clear monetization/pricing story',
        'Commodity positioning in a crowded market',
        'No proof of adoption',
        'Too broad ICP (“everyone”)',
        'Overhyped claims with no demo',
      ],
    },
    general: {
      priorities: [
        'Feels trustworthy and easy to understand',
        'Solves a real problem with minimal setup',
        'Transparent pricing',
        'Works with existing workflow',
        'Doesn’t create new risk',
      ],
      redFlags: [
        'Hard to understand / too much jargon',
        'Hidden pricing',
        'Too much setup',
        'Sketchy data practices',
        'Overpromising',
      ],
    },
  }[category] ?? {
    priorities: [
      'Clarity of value',
      'Time-to-value',
      'Workflow fit',
      'Pricing transparency',
      'Trustworthiness',
    ],
    redFlags: [
      'Buzzword soup',
      'Hidden pricing',
      'No proof',
      'Complex setup',
      'Sketchy data handling',
    ],
  };

  // Light signal-based tweaks (keeps everything deterministic and aligned with anchors).
  const priorities = [...base.priorities];
  const redFlags = [...base.redFlags];

  if (signals.has('security_cert') && !priorities[0].toLowerCase().includes('soc')) {
    priorities.unshift('Proof of security/compliance (SOC 2/ISO) and clear policies');
    priorities.pop();
  }
  if (signals.has('docs') && !priorities.some(p => p.toLowerCase().includes('docs'))) {
    priorities.unshift('Documentation quality (API reference, quickstart, examples)');
    priorities.pop();
  }
  if (signals.has('screenshots') && !priorities.some(p => p.toLowerCase().includes('screenshots'))) {
    priorities.unshift('Real workflow screenshots or short demo (not marketing)');
    priorities.pop();
  }
  if (signals.has('no_call') && !redFlags.some(r => r.toLowerCase().includes('call'))) {
    redFlags.unshift('Evaluation gated behind “book a call”');
    redFlags.pop();
  }
  if (signals.has('templates') && !priorities.some(p => p.toLowerCase().includes('templates'))) {
    priorities.splice(2, 0, 'Templates/examples that reduce blank-canvas work');
    priorities.pop();
  }

  return { priorities: priorities.slice(0, 5), redFlags: redFlags.slice(0, 5) };
}

function skepticismToRiskTolerance(skepticism) {
  if (skepticism === 'very_high') return 'Low';
  if (skepticism === 'high') return 'Low';
  if (skepticism === 'medium') return 'Medium';
  return 'Medium';
}

function priceSensitivityFromBudgetMax(max) {
  if (max <= 60) return 'High';
  if (max <= 200) return 'Medium';
  return 'Low';
}

function inferCryptoInvestmentExperience(seed, pack) {
  const text = `${seed.personaId} ${seed.role} ${seed.archetype}`.toLowerCase();
  const has = (keywords) => keywords.some((k) => text.includes(k));

  if (has(['degen', 'memecoin', 'yield farm'])) return 'very_high';
  if (has(['smart contract', 'smart_contract', 'web3', 'defi', 'onchain', 'solidity', 'evm'])) {
    return 'high';
  }
  if (has(['crypto', 'blockchain', 'token', 'wallet', 'nft', 'trader'])) {
    return 'high';
  }
  if (has(['investor', 'angel', 'venture', 'founder', 'finance'])) return 'medium';
  if (pack === 'ph_grinder') return 'low';
  return 'none';
}

function inferDegenLevel(seed, pack, cryptoInvestmentExperience) {
  const text = `${seed.personaId} ${seed.role} ${seed.archetype}`.toLowerCase();
  const has = (keywords) => keywords.some((k) => text.includes(k));

  if (has(['degen', 'memecoin', 'yield farm'])) return 'extreme';
  if (has(['smart contract', 'smart_contract', 'web3', 'defi', 'onchain', 'solidity', 'evm', 'trader'])) {
    return 'high';
  }
  if (has(['crypto', 'blockchain', 'token', 'wallet', 'nft'])) return 'medium';
  if (cryptoInvestmentExperience === 'high' || cryptoInvestmentExperience === 'very_high') return 'medium';
  if (cryptoInvestmentExperience === 'medium') return 'low';
  if (pack === 'ph_grinder') return 'low';
  return 'none';
}

function generateVoiceBlock({ displayName, role, archetype, skepticismLevel, procurement, refusedData, anchors }, pack, rng) {
  const lead = `You are ${displayName}, ${role}.`;
  const constraints = `You have limited time and you avoid anything that could create risk with ${refusedData}.`;
  const skeptical = skepticismLevel === 'very_high'
    ? 'You assume most claims are marketing until proven with specifics.'
    : skepticismLevel === 'high'
      ? 'You’re skeptical by default and look for concrete proof.'
      : skepticismLevel === 'medium'
        ? 'You’re cautiously optimistic, but you need clarity fast.'
        : 'You’re open to trying new tools if they feel safe and simple.';

  const anchorLine = anchors.length > 0 ? `In practice: ${anchors[0].replace(/^[*-]\\s*/, '')}` : `In practice, you want to understand value and setup within a few minutes.`;
  const proof = pack === 'ph_grinder'
    ? 'You’re influenced by social proof and polished presentation, but you still want a clear “how it works.”'
    : pack === 'low_exposure' || pack === 'everyday_low_exposure'
      ? 'You need a self-serve path; you will not book a call.'
      : 'You prefer a self-serve trial or a short demo.';

  const procurementLine = `Procurement reality: ${procurement}.`;
  const close = `You’ll be convinced by a crisp explanation, real screenshots, transparent pricing, and proof that the tool can be adopted safely without extra process.`;

  const voice = [lead, skeptical, constraints, anchorLine, proof, procurementLine, close]
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

  // Ensure word count in range by trimming or padding a bit.
  let wc = wordCount(voice);
  if (wc > 160) {
    return voice.split(/\s+/).slice(0, 160).join(' ').replaceAll(/\s+$/, '');
  }
  if (wc < 80) {
    const pad = `You don’t want a “platform”; you want a tool that works today, with clear limits and an easy rollback.`;
    const padded = `${voice} ${pad}`;
    wc = wordCount(padded);
    if (wc > 160) return padded.split(/\s+/).slice(0, 160).join(' ');
    return padded;
  }
  return voice;
}

function generatePersonaDoc(seed, anchors, pack) {
  const rng = mulberry32(hashStringToUint32(seed.personaId));
  const category = inferCategory(seed);
  const region = inferRegion(seed.displayName, rng);
  const age = inferAge(seed.role, rng);
  const stage = inferCompanyStage(seed.role, rng);
  const companySize = inferCompanySize(stage, rng);
  const industry = inferIndustry(seed.role);
  const seniority = deriveSeniority(seed.role);
  const employmentStatus = inferEmploymentStatus(seed.role);
  const budget = parseBudgetRange(seed.budgetRange);
  const cryptoInvestmentExperience = inferCryptoInvestmentExperience(seed, pack);
  const degenLevel = inferDegenLevel(seed, pack, cryptoInvestmentExperience);
  const income = inferMonthlyIncomeUSD(category, seniority, stage, rng);

  const household = age < 28
    ? pick(rng, ['Single, roommates', 'Single', 'Lives with partner'])
    : age < 40
      ? pick(rng, ['Lives with partner', 'Married, 1 child', 'Married, no kids'])
      : pick(rng, ['Married, 2 kids', 'Married, 1 child', 'Lives with partner']);

  const hours = pick(rng, ['9:30–18:00', '9:00–17:30', '10:00–18:30', '8:30–17:00']);

  const tools = toolsFor(category, rng);
  const alternatives = alternativesFor(category, rng);
  const { priorities, redFlags } = makePrioritiesAndRedFlags(category, seed, anchors);

  const priceSensitivity = priceSensitivityFromBudgetMax(budget.max);
  const riskTolerance = skepticismToRiskTolerance(seed.skepticismLevel);

  const skepticalSignals = [
    ...(seed.skepticismLevel === 'very_high' ? ['requires hard proof', 'assumes marketing exaggeration'] : []),
    ...(seed.skepticismLevel === 'high' ? ['looks for concrete specifics'] : []),
    ...(seed.skepticismLevel === 'medium' ? ['needs clarity quickly'] : []),
  ];

  const distrust = [
    ...redFlags,
    ...(anchors.some(a => a.toLowerCase().includes('jargon')) ? ['Jargon-heavy copy with no examples'] : []),
  ].slice(0, 7);

  const excitement = [
    ...priorities.map(p => p.replace(/^\w/, (c) => c.toUpperCase())),
    'Transparent pricing and an obvious “try it now” path',
    'Short demo video showing the real workflow',
  ].slice(0, 7);

  const launch = packLaunchBehavior(pack);

  const voiceBlock = generateVoiceBlock(
    {
      displayName: seed.displayName,
      role: seed.role,
      archetype: seed.archetype,
      skepticismLevel: seed.skepticismLevel,
      procurement: seed.procurement,
      refusedData: seed.refusedData,
      anchors,
    },
    pack,
    rng
  );

  const decisionStyle = (() => {
    if (pack === 'low_exposure' || pack === 'everyday_low_exposure') {
      return 'Decides quickly from screenshots, pricing, and one proof point; won’t book a call.';
    }
    if (seed.skepticismLevel === 'very_high') {
      return 'Needs concrete proof (docs, security details, real workflow) before trying anything.';
    }
    if (seed.skepticismLevel === 'high') {
      return 'Wants a crisp demo and proof; will test in a small, low-risk sandbox first.';
    }
    return 'Tries it if it’s easy to start and clearly reduces work within the first day.';
  })();

  const willingMax = Math.max(budget.min, clampInt(budget.max * (priceSensitivity === 'High' ? 0.6 : priceSensitivity === 'Medium' ? 0.75 : 0.9), budget.min, budget.max));

  const hardStop = budget.max <= 60 ? `$${budget.max}/mo` : budget.max <= 200 ? `$${budget.max}/mo (self-serve)` : `$${budget.max}/mo unless ROI is obvious`;

  const securitySensitivity = seed.refusedData.toLowerCase().includes('pii') || seed.refusedData.toLowerCase().includes('source code') || seed.refusedData.toLowerCase().includes('credentials')
    ? 'High'
    : seed.refusedData.toLowerCase().includes('financial') ? 'High' : 'Medium';

  const device = category === 'engineering' || category === 'design' ? pick(rng, ['MacBook Pro + external monitor', 'MacBook Air + iPhone']) : pick(rng, ['Windows laptop + iPhone', 'MacBook Pro', 'Windows laptop']);

  const education = (() => {
    if (category === 'engineering' || category === 'security' || category === 'data') {
      return pick(rng, ['Bachelor', 'Master', 'Bootcamp']);
    }
    if (category === 'finance') return pick(rng, ['Bachelor', 'Master']);
    if (category === 'people' || category === 'marketing' || category === 'product' || category === 'design') return pick(rng, ['Bachelor', 'Bachelor', 'Master']);
    return pick(rng, ['Bachelor', 'Bachelor', 'Bootcamp']);
  })();

  const credentials = (() => {
    const r = seed.role.toLowerCase();
    if (r.includes('pmp')) return 'PMP';
    if (category === 'security') return pick(rng, ['Security+ (expired)', 'CISSP (in progress)', 'None']);
    if (category === 'it') return pick(rng, ['Okta Admin cert', 'ITIL Foundation', 'None']);
    if (category === 'finance') return pick(rng, ['CPA', 'None']);
    return 'None';
  })();

  const oneLinerAre = (() => {
    if (category === 'support') return 'I keep customers happy and protect our time by eliminating avoidable tickets.';
    if (category === 'security') return 'I reduce breach risk and vendor risk, even when it slows things down.';
    if (category === 'engineering') return 'I ship reliable systems and hate tools that add hidden complexity.';
    if (category === 'product') return 'I turn messy feedback into shippable bets and measurable outcomes.';
    if (category === 'marketing') return 'I optimize for measurable growth and distrust fluffy positioning.';
    if (category === 'sales') return 'I care about pipeline and speed, but I won’t use anything that feels spammy.';
    if (category === 'design') return 'I obsess over craft and hate tools that fight the workflow.';
    if (category === 'finance') return 'I keep the numbers clean and avoid surprises.';
    if (category === 'people') return 'I keep hiring and people ops moving with minimal chaos.';
    if (category === 'it') return 'I keep the company’s tools running and avoid anything that breaks trust.';
    if (category === 'founder') return 'I look for leverage: distribution, speed, and a real moat.';
    return 'I want tools that save time without creating new problems.';
  })();

  const oneLinerWant = (() => {
    if (priceSensitivity === 'High') return 'Save hours/week without paying for another “platform.”';
    if (seed.skepticismLevel === 'very_high') return 'Save time without creating security or compliance risk.';
    return 'Save hours/week with a tool that is easy to adopt and hard to misuse.';
  })();

  const goals = (() => {
    const baseGoals = {
      engineering: ['Reduce integration/maintenance overhead', 'Increase team shipping velocity safely', 'Avoid incidents and rollbacks'],
      security: ['Reduce vendor risk', 'Make compliance/audit easier', 'Prevent data exposure'],
      product: ['Increase activation and retention', 'Ship the right features faster', 'Reduce cross-team thrash'],
      design: ['Produce high-quality assets quickly', 'Reduce iteration cycles with stakeholders', 'Maintain consistency across surfaces'],
      marketing: ['Increase qualified traffic and conversion', 'Ship campaigns faster', 'Prove ROI with clean attribution'],
      sales: ['Increase qualified pipeline', 'Shorten sales cycles', 'Improve rep productivity'],
      support: ['Reduce handle time', 'Increase first-contact resolution', 'Keep CSAT high while scaling'],
      people: ['Reduce scheduling/admin load', 'Improve candidate experience', 'Keep process compliant and consistent'],
      finance: ['Close books faster', 'Reduce errors and reconcile cleanly', 'Make spend predictable and auditable'],
      it: ['Roll out tools safely at scale', 'Reduce tickets and access issues', 'Keep identity and access controlled'],
      data: ['Deliver trusted metrics', 'Reduce ad-hoc fire drills', 'Make analysis reproducible'],
      founder: ['Find distribution leverage', 'Validate willingness to pay', 'Ship faster than competitors'],
      general: ['Save time', 'Avoid mistakes', 'Look competent internally'],
    }[category] ?? ['Save time', 'Reduce risk', 'Improve outcomes'];

    return baseGoals;
  })();

  const pains = (() => {
    const basePains = {
      engineering: ['Tools that promise “magic” but break edge cases', 'Long onboarding and migration cost', 'Vendor lock-in / unclear failure modes'],
      security: ['Vendors hiding data flows', 'Lack of auditability', 'Teams adopting tools without review'],
      product: ['Ambiguous positioning', 'Slow iteration due to handoffs', 'Tools that don’t fit existing workflow'],
      design: ['Blank-canvas tools with no templates', 'Export/handoff friction', 'Stakeholder churn and last-minute changes'],
      marketing: ['Hard-to-measure impact', 'Tool sprawl and brittle automations', 'Landing pages that don’t convert'],
      sales: ['Low-quality leads', 'Tools that hurt deliverability', 'Reps not adopting complicated workflows'],
      support: ['Repetitive tickets', 'Missing context across tools', 'Customer data sensitivity slowing down tooling'],
      people: ['Calendar ping-pong', 'Inconsistent interview process', 'Candidate drop-off from friction'],
      finance: ['Messy data and reconciliation', 'Approval bottlenecks', 'Unexpected tool spend'],
      it: ['Shadow IT', 'SSO/permission mismatches', 'Rollouts that create tickets'],
      data: ['Metric definitions changing', 'Stakeholders asking for “quick” numbers', 'Pipelines breaking silently'],
      founder: ['Distribution uncertainty', 'Noisy feedback', 'Time wasted on non-differentiated features'],
      general: ['Too many tools', 'Unclear instructions', 'Fear of messing something up'],
    }[category] ?? ['Too many tools', 'Not enough time', 'Unclear ROI'];
    return basePains;
  })();

  const freeTier = priceSensitivity === 'High'
    ? 'Must be usable without talking to sales; enough to test on a small, real task.'
    : 'A trial or free tier that lets you evaluate without a call.';

  const refund = priceSensitivity === 'High'
    ? 'Wants a clear trial and easy cancellation; doesn’t want to fight for a refund.'
    : 'Expects a 7–14 day trial or a pro-rated refund policy.';

  const personaMd = `# Persona: ${seed.displayName} (\`${seed.personaId}\`)

## 0) Identity
- **Persona ID (snake_case):** \`${seed.personaId}\`
- **Display name:** ${seed.displayName}
- **Archetype (1–3 words):** ${seed.archetype}
- **Role (short):** ${seed.role}
- **One-liner (what they *are*):** “${oneLinerAre}”
- **One-liner (what they *want*):** “${oneLinerWant}”

## 1) Demographics & Context
- **Age:** ${age}
- **Location:** ${region.location}
- **Timezone / working hours:** ${region.tz}, ${hours}
- **Languages:** ${region.languages}
- **Household:** ${household}

## 2) Employment & Socioeconomics (be explicit)
- **Employment status:** ${employmentStatus}
- **Job title:** ${seed.role.split(' at ')[0]}
- **Seniority:** ${seniority}
- **Industry:** ${industry}
- **Company stage:** ${stage}
- **Company size:** ${companySize}
- **Team:** ${category === 'engineering'
    ? `8-person product squad (2 FE, 3 BE, 1 design, 1 PM, 1 QA)`
    : category === 'support'
      ? `Support team of ~${clampInt(6 + rng() * 14, 6, 20)} agents; works closely with CX ops + engineering`
      : category === 'sales'
        ? `Sales pod of ~${clampInt(4 + rng() * 10, 4, 14)} reps + 1 manager + RevOps support`
        : `Cross-functional team, collaborates with 3–6 stakeholders weekly`}
- **Monthly income (gross):** $${income.min.toLocaleString()}–$${income.max.toLocaleString()}
- **Cash constraints:** ${budget.max <= 60 ? 'Personal budget is tight; must justify any recurring spend.' : budget.max <= 200 ? 'Can expense small tools, but anything bigger needs a clear ROI.' : 'Can expense tools if there’s clear ROI and low risk.'}

## 3) Education & Credentials
- **Highest education:** ${education}
- **Field/major:** ${category === 'engineering' || category === 'security' || category === 'data'
    ? pick(rng, ['Computer Science', 'Information Systems', 'Electrical Engineering'])
    : category === 'finance'
      ? pick(rng, ['Accounting', 'Finance', 'Business'])
      : category === 'design'
        ? pick(rng, ['Design', 'HCI', 'Communication'])
        : pick(rng, ['Business', 'Communications', 'Psychology'])}
- **School tier (rough):** ${pick(rng, ['Local state school', 'Top 50', 'Private university', 'Self-taught'])}
- **Credentials:** ${credentials}

## 4) Tools, Workflow, and Technical Comfort
- **Primary devices:** ${device}
- **Daily tools:** ${tools.join(', ')}
- **Tech stack familiarity (if relevant):** ${category === 'engineering'
    ? pick(rng, ['React/Next.js, Node, Postgres, AWS', 'Python, Postgres, GCP, Kubernetes', 'Java/Kotlin, AWS, Kafka, Postgres'])
    : category === 'data'
      ? pick(rng, ['SQL, dbt basics, Looker/Metabase', 'BigQuery + Sheets + basic Python', 'Snowflake + Looker + dbt'])
      : 'N/A'}
- **Procurement reality:** ${seed.procurement}
- **Security/compliance sensitivity:** ${securitySensitivity} (because of ${seed.refusedData})
- **Data they refuse to upload:** ${seed.refusedData}

## 5) Buying Power & Budget (separate “can” vs “will”)
- **Monthly software budget (can spend):** ${seed.budgetRange}
- **Monthly software budget (willing to spend):** $${budget.min}–$${willingMax}
- **Payment preference:** ${seed.procurement.toLowerCase().includes('invoice') ? 'Invoice (preferred)' : 'Credit card / monthly'}
- **Approval path:** ${seed.procurement}
- **Typical deal size:** ${budget.max <= 60 ? '$10–$49/mo' : budget.max <= 200 ? '$30–$150/mo' : '$100–$500/mo (self-serve)'}
- **Alternatives they already use:** ${alternatives.join(', ')}

## 6) Goals, Pains, and Decision Psychology
- **Top goals (3):**
  1. ${goals[0]}
  2. ${goals[1]}
  3. ${goals[2]}
- **KPIs they’re measured on:** ${category === 'support'
    ? 'CSAT, first response time, handle time, backlog size'
    : category === 'sales'
      ? 'Pipeline created, meetings booked, win rate, sales cycle length'
      : category === 'marketing'
        ? 'Conversion rate, CAC, ROAS, qualified leads'
        : category === 'engineering'
          ? 'Delivery velocity, incident rate, latency/SLOs'
          : category === 'product'
            ? 'Activation, retention, feature adoption'
            : category === 'finance'
              ? 'Close time, error rate, burn vs plan'
              : 'Time saved and quality outcomes'}
- **Top pains (3):**
  1. ${pains[0]}
  2. ${pains[1]}
  3. ${pains[2]}
- **Fears / risks:** ${[...new Set(['Vendor lock-in', ...skepticalSignals, seed.refusedData ? `Accidental exposure of ${seed.refusedData}` : 'Data mishandling'])].slice(0, 3).join(', ')}
- **What triggers immediate distrust:** ${distrust.join('; ')}
- **What triggers excitement:** ${excitement.join('; ')}
- **Risk tolerance:** ${riskTolerance} (failure looks like wasted time, broken workflow, or data risk)
- **Adoption style:** ${seed.skepticismLevel === 'very_high' || seed.skepticismLevel === 'high' ? 'Pragmatist' : 'Early adopter (if low risk)'}

## 7) “Launch Platform” (Product Hunt/HN) Behavior
- **Why they browse:** ${launch.why}
- **Attention span:** ${launch.attention}
- **What makes them click:** ${launch.click.join('; ')}
- **Comment style:** ${launch.commentStyle}
- **Upvote triggers:** ${launch.upvote.join('; ')}
- **Bounce triggers:** ${launch.bounce.join('; ')}
- **Social proof susceptibility:** ${launch.proof.susceptibility}
  - **If High:** ${launch.proof.what}

## 8) Pricing & Monetization Beliefs
- **What “fair pricing” means:** ${priceSensitivity === 'High'
    ? 'A small monthly fee that clearly maps to time saved; no surprise usage fees.'
    : priceSensitivity === 'Medium'
      ? 'Pricing that scales with real value and doesn’t punish early adoption.'
      : 'Paying more is fine if the tool creates compounding leverage and low risk.'}
- **Price sensitivity:** ${priceSensitivity}
- **Hard stop price points:** ${hardStop}
- **Free tier expectations:** ${freeTier}
- **Refund/trial expectations:** ${refund}

## 9) Persona Voice (prompt-ready)
**Voice block:**
> ${voiceBlock}

## 10) Engine Mapping (today’s code)
- **id:** \`${seed.personaId}\`
- **name:** ${seed.displayName}
- **role:** ${seed.role}
- **context:** ${voiceBlock}
- **priorities:** ${priorities.map(p => `"${p}"`).join(', ')}
- **redFlags:** ${redFlags.map(r => `"${r}"`).join(', ')}
- **budgetRange:** \`{ min: ${budget.min}, max: ${budget.max} }\`
- **skepticismLevel:** \`${seed.skepticismLevel}\`
- **decisionStyle:** ${decisionStyle}
- **cryptoInvestmentExperience:** \`${cryptoInvestmentExperience}\`
- **degenLevel:** \`${degenLevel}\`
`;

  const wc = wordCount(voiceBlock);
  if (wc < 80 || wc > 160) throw new Error(`Voice block out of range for ${seed.personaId}: ${wc} words`);

  return personaMd;
}

function parseTicketFile(content, filePath) {
  const get = (re, label) => {
    const m = content.match(re);
    if (!m) throw new Error(`Missing ${label} in ${filePath}`);
    return m[1].trim();
  };

  const personaId = get(/^- Persona ID \(snake_case\):\s*`([^`]+)`/m, 'Persona ID');
  const displayName = get(/^- Display name:\s*(.+)$/m, 'Display name');
  const archetype = get(/^- Archetype.*?:\s*(.+)$/m, 'Archetype');
  const role = get(/^- Role \(short\):\s*(.+)$/m, 'Role');
  const budgetRange = get(/^- Budget range.*?:\s*(.+)$/m, 'Budget range');
  const skepticismLevel = get(/^- Skepticism level:\s*`([^`]+)`/m, 'Skepticism level');
  const procurement = get(/^- Procurement reality:\s*(.+)$/m, 'Procurement reality');
  const refusedData = get(/^- Data they refuse to upload:\s*(.+)$/m, 'Refused data');

  const anchorsSection = content.match(/## Behavioral Anchors\s*\n([\s\S]*?)(\n## |\n$)/);
  const anchorsRaw = anchorsSection ? anchorsSection[1] : '';
  const anchors = anchorsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^- /, '').trim())
    .filter(Boolean);

  return {
    seed: {
      personaId,
      displayName,
      archetype,
      role,
      budgetRange,
      skepticismLevel,
      procurement,
      refusedData,
    },
    anchors,
  };
}

function markTicketDone(ticketContent, { personaId }) {
  let out = ticketContent;
  out = out.replace(/^- Status:\s*\[[ x~]\]\s*.*$/m, '- Status: [x] Done');
  out = out.replace(
    /## Completion Notes\s*\n- \(fill after done\)/m,
    `## Completion Notes\n- Generated \`personas/${personaId}.md\` via \`scripts/generate-personas.mjs\``
  );
  return out;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.ticketsDir) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const repoRoot = process.cwd();
  const ticketsDir = path.resolve(repoRoot, args.ticketsDir);
  const dirBase = path.basename(ticketsDir);
  const pack = getPackTypeFromDirName(dirBase);

  const entries = await fs.readdir(ticketsDir, { withFileTypes: true });
  const ticketFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md' && e.name !== 'INDEX.md')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const limit = args.limit ?? ticketFiles.length;
  const toProcess = ticketFiles.slice(0, limit);

  const personasDir = path.resolve(repoRoot, 'personas');
  await fs.mkdir(personasDir, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let updatedTickets = 0;

  for (const fileName of toProcess) {
    const ticketPath = path.join(ticketsDir, fileName);
    const ticketContent = await fs.readFile(ticketPath, 'utf8');
    const { seed, anchors } = parseTicketFile(ticketContent, ticketPath);

    const outPath = path.join(personasDir, `${seed.personaId}.md`);
    const exists = await fileExists(outPath);
    if (exists && !args.force) {
      skipped += 1;
    } else {
      const personaDoc = generatePersonaDoc(seed, anchors, pack);
      if (args.write) await fs.writeFile(outPath, personaDoc, 'utf8');
      generated += 1;
    }

    const isDone = /- Status:\s*\[x\]\s*Done/m.test(ticketContent);
    if (!isDone) {
      const updated = markTicketDone(ticketContent, seed);
      if (args.write) await fs.writeFile(ticketPath, updated, 'utf8');
      updatedTickets += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        pack,
        ticketsDir: path.relative(repoRoot, ticketsDir),
        processed: toProcess.length,
        generated,
        skipped,
        updatedTickets,
      },
      null,
      2
    )
  );
}

await main();
