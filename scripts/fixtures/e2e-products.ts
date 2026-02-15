export type E2ERunMode = 'quick' | 'deep';

export interface E2EProductScenario {
  id: string;
  label: string;
  input: {
    tagline: string;
    description: string;
    pricingModel: 'free' | 'freemium' | 'subscription' | 'one_time' | 'usage_based' | 'custom';
    url: string;
    category: string;
    tags: string[];
    runMode: E2ERunMode;
    platformMode: 'product_hunt';
    phSubmission: {
      productName: string;
      phTagline: string;
      phDescription: string;
      topics: string[];
      makerFirstComment: string;
    };
  };
}

const BASE_SCENARIOS: Omit<E2EProductScenario, 'id'>[] = [
  {
    label: 'Devtool Launch Optimizer',
    input: {
      tagline: 'Simulate launch-day reactions before shipping your Product Hunt post',
      description: 'SimVibe runs persona-based launch simulations and returns traction signals, friction hotspots, and launch copy suggestions for Product Hunt makers.',
      pricingModel: 'freemium',
      url: 'https://example.com/simvibe-devtool',
      category: 'Developer Tools',
      tags: ['AI', 'Productivity', 'Developer Tools'],
      runMode: 'quick',
      platformMode: 'product_hunt',
      phSubmission: {
        productName: 'SimVibe',
        phTagline: 'Predict Product Hunt traction before launch day',
        phDescription: 'Run persona-based simulations to uncover friction, improve messaging, and ship a stronger Product Hunt launch.',
        topics: ['Artificial Intelligence', 'Developer Tools', 'Productivity'],
        makerFirstComment: 'Built this after too many blind launches. We now simulate how different personas react before posting. Feedback on what signals you trust most would help.',
      },
    },
  },
  {
    label: 'Creator Revenue Helper',
    input: {
      tagline: 'Turn audience signals into launch-ready growth plans',
      description: 'AudienceLoop helps creators map attention into conversion-ready plans with signal scoring, messaging tests, and launch readiness checks.',
      pricingModel: 'subscription',
      url: 'https://example.com/audience-loop',
      category: 'Marketing',
      tags: ['Analytics', 'Growth', 'Creator Economy'],
      runMode: 'quick',
      platformMode: 'product_hunt',
      phSubmission: {
        productName: 'AudienceLoop',
        phTagline: 'Know what your audience will buy before launch',
        phDescription: 'Model audience intent, test offers, and launch with confidence using one signal-driven workspace.',
        topics: ['Marketing', 'Analytics', 'Creator Economy'],
        makerFirstComment: 'We built AudienceLoop for teams that get views but miss conversions. Would love feedback on which intent metrics are most actionable for you.',
      },
    },
  },
  {
    label: 'B2B Ops Agent',
    input: {
      tagline: 'Automate repetitive ops work with guardrailed AI agents',
      description: 'OpsRelay handles recurring back-office workflows with approval gates, audit trails, and SLA-focused execution across tools.',
      pricingModel: 'usage_based',
      url: 'https://example.com/ops-relay',
      category: 'Business',
      tags: ['Automation', 'B2B', 'Operations'],
      runMode: 'quick',
      platformMode: 'product_hunt',
      phSubmission: {
        productName: 'OpsRelay',
        phTagline: 'AI agents for recurring ops tasks with approvals',
        phDescription: 'Delegate repetitive operations to AI agents while keeping approvals, audit history, and reliability controls in place.',
        topics: ['Artificial Intelligence', 'SaaS', 'Productivity'],
        makerFirstComment: 'OpsRelay is built for teams stuck in manual ops loops. Looking for feedback on where approval gates should be strict vs flexible.',
      },
    },
  },
];

export function buildE2EProductScenarios(
  count: number,
  runMode: E2ERunMode,
): E2EProductScenario[] {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 3;
  const scenarios: E2EProductScenario[] = [];

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
        url: `https://example.com/${id}`,
        phSubmission: {
          ...base.input.phSubmission,
          productName: `${base.input.phSubmission.productName}${suffix}`.slice(0, 60),
          phTagline: base.input.phSubmission.phTagline.slice(0, 60),
          phDescription: base.input.phSubmission.phDescription.slice(0, 260),
        },
      },
    });
  }

  return scenarios;
}
