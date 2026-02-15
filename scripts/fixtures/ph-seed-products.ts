export interface PHSeedProduct {
  slug: string;
  productName: string;
  phTagline: string;
  phDescription: string;
  topics: string[];
  makerFirstComment: string;
  sourceUrl: string;
  website?: string;
  pricingModel: 'free' | 'freemium' | 'subscription' | 'one_time' | 'usage_based' | 'custom';
  category: string;
  tags: string[];
}

export const PH_SEED_PRODUCTS: PHSeedProduct[] = [
  {
    slug: 'conva-ai',
    productName: 'Conva.AI',
    phTagline: 'Build an AI Assistant for your App in 1 click',
    phDescription:
      "Conva.AI is an assistant-as-a-service platform that helps developers create, integrate, and maintain AI assistants without deep prompt engineering.",
    topics: ['Developer Tools', 'Artificial Intelligence', 'SDK'],
    makerFirstComment:
      "We built Conva.AI so teams can ship assistant UX fast without fighting low-level AI plumbing. Would love feedback on where assistant-in-app adoption fails most in your stack.",
    sourceUrl: 'https://www.producthunt.com/posts/473299',
    website: 'https://conva.ai',
    pricingModel: 'freemium',
    category: 'Developer Tools',
    tags: ['AI', 'SDK', 'Developer Tools'],
  },
  {
    slug: 'my-askai',
    productName: 'My AskAI',
    phTagline: 'Create an AI customer support assistant for your SaaS',
    phDescription:
      'AI assistant for SaaS support with automated insights from conversations, human handover to chat tools, and site updates to reduce churn.',
    topics: ['Customer Success', 'SaaS', 'Developer Tools'],
    makerFirstComment:
      "Our goal is practical support impact: faster answers, cleaner handoff, and better activation. Curious which support metrics matter most before teams trust AI-first support.",
    sourceUrl: 'https://www.producthunt.com/posts/ultimategpt',
    website: 'https://myaskai.com',
    pricingModel: 'subscription',
    category: 'Customer Support',
    tags: ['AI', 'SaaS', 'Support'],
  },
  {
    slug: 'ariana-ai',
    productName: 'Ariana AI',
    phTagline: 'ChatGPT-powered AI assistant in WhatsApp',
    phDescription:
      'Ariana is a WhatsApp-native AI assistant for fast Q&A, guidance, and everyday help with no separate API setup or installs.',
    topics: ['Artificial Intelligence', 'Bots', 'Tech'],
    makerFirstComment:
      "We focused on one behavior: get ChatGPT value inside WhatsApp with minimal friction. Tell us where mobile AI assistants still break down in real daily use.",
    sourceUrl: 'https://www.producthunt.com/posts/ariana-ai',
    website: 'https://www.arianaai.com',
    pricingModel: 'freemium',
    category: 'Artificial Intelligence',
    tags: ['AI', 'Chatbot', 'WhatsApp'],
  },
  {
    slug: 'get-productive',
    productName: 'Get Productive',
    phTagline: 'Gamified app rewarding screen time reduction',
    phDescription:
      'A timer app that only runs when you stay off distracting apps, turning focus sessions into game rewards and character progression.',
    topics: ['Productivity', 'Fashion', 'Free Games'],
    makerFirstComment:
      "I wanted focus tools to feel fun instead of punitive. We used progression loops to reward reduced screen time. Feedback on retention hooks is very welcome.",
    sourceUrl: 'https://www.producthunt.com/posts/get-productive',
    website: 'https://apps.apple.com',
    pricingModel: 'free',
    category: 'Productivity',
    tags: ['Productivity', 'Mobile', 'Focus'],
  },
  {
    slug: 'productivehub',
    productName: 'ProductiveHub',
    phTagline: 'Discover how to skyrocket your productivity!',
    phDescription:
      'ProductiveHub curates productivity tools and practical articles to help users beat procrastination and improve daily workflows.',
    topics: ['Productivity', 'Maker Tools', 'Remote Work'],
    makerFirstComment:
      "We built ProductiveHub to reduce app overload and help people find practical workflows quickly. Share the productivity stack pieces you still struggle to unify.",
    sourceUrl: 'https://www.producthunt.com/posts/productivehub',
    website: 'https://www.productive-hub.com',
    pricingModel: 'free',
    category: 'Productivity',
    tags: ['Productivity', 'Curation', 'Remote Work'],
  },
  {
    slug: 'artificial-intelligence-tools',
    productName: 'Artificial Intelligence Tools',
    phTagline: 'AI tools for content creation',
    phDescription:
      'A unified AI content platform covering copywriting, image workflows, rewriting, PDF/chat interaction, and coding assistance.',
    topics: ['AI notetakers', 'Note and writing apps', 'Search'],
    makerFirstComment:
      "We’re trying to consolidate fragmented AI content workflows into one place. Which content task still requires too many separate tools in your process?",
    sourceUrl: 'https://www.producthunt.com/posts/artificial-intelligence-tools',
    website: 'https://magika.space',
    pricingModel: 'freemium',
    category: 'Artificial Intelligence',
    tags: ['AI', 'Content Creation', 'Writing'],
  },
  {
    slug: 'instaprompt-ai',
    productName: 'instaprompt.ai',
    phTagline: 'Improve your ChatGPT productivity',
    phDescription:
      'A prompt discovery product for GPT usage across multiple topics so users can find and apply useful prompts faster.',
    topics: ['Work & Productivity', 'ChatGPT Prompts', 'Online learning'],
    makerFirstComment:
      "Prompt discovery remains messy for many users. We want reusable prompt workflows to be easier and less trial-and-error. What prompt category should we improve first?",
    sourceUrl: 'https://www.producthunt.com/posts/instaprompt-ai',
    website: 'https://instaprompt.ai',
    pricingModel: 'freemium',
    category: 'Productivity',
    tags: ['ChatGPT', 'Prompts', 'Productivity'],
  },
];
