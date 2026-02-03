import type { LandingExtract, AgentOutput, Report, RunInput, PersonaId } from '@simvibe/shared';

export interface DemoProduct {
  input: RunInput;
  landingExtract: LandingExtract;
  agentOutputs: AgentOutput[];
  report: Report;
}

const DEMO_RUN_ID = 'demo_run_001';

export const DEMO_PRODUCTS: Record<string, DemoProduct> = {
  codereviewer: {
    input: {
      tagline: 'Ship code reviews 10x faster with AI',
      description: 'AI-powered code review tool that catches bugs before they hit production. Integrates with GitHub, GitLab, and Bitbucket. Get intelligent suggestions, security vulnerability detection, and performance insights.',
      pricingModel: 'freemium',
      pricePoints: [
        { tier: 'Free', price: 0, currency: 'USD' },
        { tier: 'Pro', price: 29, currency: 'USD', period: 'monthly' },
        { tier: 'Team', price: 99, currency: 'USD', period: 'monthly' },
      ],
      category: 'Developer Tools',
      tags: ['AI', 'Code Review', 'DevOps', 'GitHub'],
    },
    landingExtract: {
      title: 'CodeReviewer - AI Code Review',
      sections: [
        {
          type: 'hero',
          content: '# Ship code reviews 10x faster with AI\n\nStop spending hours on code reviews. Let AI catch bugs, security issues, and style problems automatically.\n\nTrusted by 5,000+ developers at companies like Stripe, Vercel, and Linear.',
          confidence: 0.95,
        },
        {
          type: 'features',
          content: '## Features\n\n- **Instant Bug Detection**: AI analyzes your code for common bugs and anti-patterns\n- **Security Scanning**: Catches OWASP Top 10 vulnerabilities before they ship\n- **Style Enforcement**: Automatically enforces your team\'s coding standards\n- **Performance Insights**: Identifies N+1 queries, memory leaks, and bottlenecks',
          confidence: 0.9,
        },
        {
          type: 'pricing',
          content: '## Pricing\n\n**Free**: 100 reviews/month, 1 repo\n**Pro** ($29/mo): Unlimited reviews, 10 repos, priority support\n**Team** ($99/mo): Unlimited everything, SSO, audit logs',
          confidence: 0.95,
        },
        {
          type: 'testimonials',
          content: '"CodeReviewer cut our review time by 80%. The AI catches things our seniors miss." - Sarah Chen, Lead Engineer at Acme',
          confidence: 0.8,
        },
      ],
      rawText: 'Ship code reviews 10x faster with AI...',
      extractedAt: new Date().toISOString(),
      extractionMethod: 'pasted',
      confidence: 0.9,
      failed: false,
    },
    agentOutputs: [
      createDemoAgentOutput('cynical_engineer', {
        productDefinition: 'AI-powered code review assistant that integrates with major git platforms',
        suspicions: ['How accurate is the AI bug detection?', 'What languages are supported?', 'Does it work with private repos securely?'],
        trustBoosters: ['Named customer references (Stripe, Vercel)', 'Specific feature list', 'Clear pricing tiers'],
        trustKillers: ['No technical documentation visible', '"10x faster" claim needs substantiation'],
        primaryFriction: 'No technical details on AI model or accuracy benchmarks',
        frictionCategory: 'technical_doubt',
        actions: [
          { action: 'UPVOTE', probability: 0.3, reasoning: 'Interesting tool but need more technical proof' },
          { action: 'SIGNUP', probability: 0.6, reasoning: 'Free tier allows evaluation without commitment' },
          { action: 'BOUNCE', probability: 0.2, reasoning: 'Might skip if reviewing more tools' },
        ],
        primaryAction: 'SIGNUP',
        oneLineFix: 'Add a "How it works" section with AI model details and accuracy benchmarks',
      }),
      createDemoAgentOutput('passionate_pm', {
        productDefinition: 'Code review automation tool targeting engineering teams',
        suspicions: ['Who exactly is the ICP - solo devs or teams?', 'How does onboarding work?', 'What\'s the time-to-value?'],
        trustBoosters: ['Clear feature benefits', 'Named logos for social proof', 'Tiered pricing for different needs'],
        trustKillers: ['No demo or trial CTA visible', 'No onboarding flow mentioned'],
        primaryFriction: 'Unclear how quickly a team can get value - no onboarding info',
        frictionCategory: 'onboarding_friction',
        actions: [
          { action: 'UPVOTE', probability: 0.5, reasoning: 'Solves a real pain point for engineering teams' },
          { action: 'SIGNUP', probability: 0.7, reasoning: 'Would try the free tier to evaluate' },
          { action: 'COMMENT', probability: 0.4, reasoning: 'Would ask about team onboarding' },
        ],
        primaryAction: 'SIGNUP',
        oneLineFix: 'Add "Get started in 5 minutes" with clear onboarding steps',
      }),
      createDemoAgentOutput('pragmatic_investor', {
        productDefinition: 'B2B SaaS for automating code review workflows',
        suspicions: ['What\'s the market size?', 'How defensible is the AI moat?', 'What\'s the expansion revenue potential?'],
        trustBoosters: ['Freemium model for bottom-up adoption', 'Team tier suggests expansion path', 'Clear value prop'],
        trustKillers: ['Crowded market with GitHub Copilot, etc.', 'No metrics on current traction'],
        primaryFriction: 'No differentiation from GitHub\'s built-in code review or Copilot',
        frictionCategory: 'pricing_concern',
        actions: [
          { action: 'UPVOTE', probability: 0.4, reasoning: 'Good execution on competitive positioning' },
          { action: 'BOUNCE', probability: 0.4, reasoning: 'Would need more traction data to invest' },
          { action: 'COMMENT', probability: 0.3, reasoning: 'Would ask about differentiation vs Copilot' },
        ],
        primaryAction: 'UPVOTE',
        oneLineFix: 'Add comparison chart showing differentiation from GitHub/Copilot code review',
      }),
      createDemoAgentOutput('ruthless_marketer', {
        productDefinition: 'AI code review tool with freemium pricing',
        suspicions: ['Is the 10x claim believable?', 'What\'s the hook for social sharing?', 'Is the CTA clear?'],
        trustBoosters: ['Strong headline with specific benefit', 'Social proof with named companies', 'Clear pricing'],
        trustKillers: ['Testimonial could be more specific', 'No urgency or scarcity'],
        primaryFriction: 'No clear CTA above the fold - where do I click?',
        frictionCategory: 'vague_value_prop',
        actions: [
          { action: 'UPVOTE', probability: 0.6, reasoning: 'Good copy, would convert well with better CTA' },
          { action: 'SHARE', probability: 0.3, reasoning: 'Would share with dev friends' },
          { action: 'SIGNUP', probability: 0.5, reasoning: 'Free tier is low friction' },
        ],
        primaryAction: 'UPVOTE',
        oneLineFix: 'Add a prominent "Start Free" button above the fold',
      }),
      createDemoAgentOutput('agency_owner', {
        productDefinition: 'Code review automation SaaS',
        suspicions: ['Does it work for client projects?', 'Can I white-label reports?', 'Is there API access?'],
        trustBoosters: ['Team pricing tier exists', 'Multiple repo support'],
        trustKillers: ['No mention of API or integrations', 'No white-label option visible'],
        primaryFriction: 'No API or white-label mentioned - can\'t use for client work',
        frictionCategory: 'other',
        actions: [
          { action: 'BOUNCE', probability: 0.5, reasoning: 'Doesn\'t seem designed for agency use case' },
          { action: 'SIGNUP', probability: 0.3, reasoning: 'Might try for internal projects' },
          { action: 'COMMENT', probability: 0.4, reasoning: 'Would ask about API access' },
        ],
        primaryAction: 'BOUNCE',
        oneLineFix: 'Add "API access" and "white-label reports" to Team tier features',
      }),
    ],
    report: createDemoReport(DEMO_RUN_ID, 'codereviewer'),
  },
};

function createDemoAgentOutput(
  personaId: PersonaId,
  data: {
    productDefinition: string;
    suspicions: string[];
    trustBoosters: string[];
    trustKillers: string[];
    primaryFriction: string;
    frictionCategory: string;
    actions: { action: string; probability: number; reasoning: string }[];
    primaryAction: string;
    oneLineFix: string;
  }
): AgentOutput {
  return {
    personaId,
    runId: DEMO_RUN_ID,
    timestamp: new Date().toISOString(),
    scan: {
      phase: 'scan',
      productDefinition: data.productDefinition,
      suspicions: data.suspicions,
    },
    skim: {
      phase: 'skim',
      trustBoosters: data.trustBoosters,
      trustKillers: data.trustKillers,
      primaryFriction: data.primaryFriction,
      frictionCategory: data.frictionCategory as AgentOutput['skim']['frictionCategory'],
    },
    action: {
      phase: 'action',
      actions: data.actions.map(a => ({
        action: a.action as AgentOutput['action']['actions'][0]['action'],
        probability: a.probability,
        reasoning: a.reasoning,
      })),
      primaryAction: data.primaryAction as AgentOutput['action']['primaryAction'],
      oneLineFix: data.oneLineFix,
    },
    isFallback: false,
  };
}

function createDemoReport(runId: string, productKey: string): Report {
  return {
    runId,
    generatedAt: new Date().toISOString(),
    tractionBand: 'moderate',
    confidence: 'high',
    metrics: {
      expectedUpvotes: 2.3,
      expectedSignups: 0.54,
      expectedPays: 0.15,
      bounceRate: 0.34,
      shareRate: 0.1,
      disagreementScore: 0.25,
      uncertaintyScore: 0.15,
    },
    scores: {
      clarity: 72,
      credibility: 68,
      differentiation: 55,
      pricingFraming: 78,
      conversionReadiness: 62,
    },
    overallScore: 67,
    frictionList: [
      {
        rank: 1,
        trigger: 'No technical details on AI model or accuracy benchmarks',
        category: 'technical_doubt',
        evidence: ['cynical_engineer: "No technical details on AI model..."'],
        agentsCiting: ['cynical_engineer'],
        severity: 0.7,
      },
      {
        rank: 2,
        trigger: 'No differentiation from GitHub\'s built-in code review or Copilot',
        category: 'pricing_concern',
        evidence: ['pragmatic_investor: "No differentiation from GitHub..."'],
        agentsCiting: ['pragmatic_investor'],
        severity: 0.6,
      },
      {
        rank: 3,
        trigger: 'No clear CTA above the fold',
        category: 'vague_value_prop',
        evidence: ['ruthless_marketer: "No clear CTA above the fold..."'],
        agentsCiting: ['ruthless_marketer'],
        severity: 0.5,
      },
    ],
    personaReports: [],
    oneLineFixes: [
      { fix: 'Add a "How it works" section with AI model details and accuracy benchmarks', source: 'cynical_engineer', priority: 1 },
      { fix: 'Add a prominent "Start Free" button above the fold', source: 'ruthless_marketer', priority: 2 },
      { fix: 'Add "Get started in 5 minutes" with clear onboarding steps', source: 'passionate_pm', priority: 3 },
      { fix: 'Add comparison chart showing differentiation from GitHub/Copilot', source: 'pragmatic_investor', priority: 4 },
      { fix: 'Add "API access" and "white-label reports" to Team tier features', source: 'agency_owner', priority: 5 },
    ],
    calibrationApplied: false,
  };
}

export function getDemoProduct(key: string): DemoProduct | undefined {
  return DEMO_PRODUCTS[key.toLowerCase()];
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}
