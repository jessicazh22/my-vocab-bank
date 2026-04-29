import type { GrammarErrorCategory } from '../lib/grammar';

export interface GrammarErrorData {
  id: string;
  original: string;
  corrected: string;
  category: GrammarErrorCategory;
  explanation: string;
  context: string;
  grammar_pattern?: {
    name: string;
    structure: string;
    examples: string[];
  };
}

export interface PositiveFeedbackData {
  segment: string;
  feedback: string;
}

export interface AnalyzedSession {
  id: string;
  speaker: string;
  topic: string;
  date: string;
  transcript: string;
  errors: GrammarErrorData[];
  positive: PositiveFeedbackData[];
}

export const GLORIA_SESSIONS: AnalyzedSession[] = [
  // ── Session 1: Career & Work-Life Balance ────────────────────────────────
  {
    id: 'gloria_career_001',
    speaker: 'Gloria',
    topic: 'Career & Work-Life Balance',
    date: 'Apr 2026',
    transcript: `So, in my makeup career, I kinda wanna be the top tier in the industry. I know this industry is very competitive, so many career people, talent in this industry. But I still think there's a chance for me to pursue a higher achievement and so I can collaborate with different brands and celebrities to express my aesthetic, and um, feelings. So, if it's me in the past, I would like to say, I wanna be an elite in the industry, working my ass off in a daily basis. In contrast, I realised now that, um, people have limited energy, and also, how important your body condition, and your health condition, in your life. I decided to work more on my work and life balance. I'll still pursue my career, whereas spend more time and energy focusing on myself, the people I love and the people who love me. So, now, work-life balance for me is very important. Um, yeah. My career is still my priority. I wanna pass my values to people to this society through my career. It helps me to make meaning in my life, and contribute to the society development.`,
    errors: [
      {
        id: 'G1',
        original: 'in a daily basis',
        corrected: 'on a daily basis',
        category: 'preposition_errors',
        explanation: "'On a daily basis' is the fixed expression. We say 'on' a … basis (daily/weekly/regular), never 'in'.",
        context: 'working my ass off [in a daily basis]',
      },
      {
        id: 'G2',
        original: 'pass my values to people to this society',
        corrected: 'pass my values on to people in this society',
        category: 'phrasal_verb_errors',
        explanation: "The phrasal verb is 'pass something on to someone'. Also, people live 'in' a society, not 'to' a society.",
        context: 'I wanna [pass my values to people to this society] through my career',
        grammar_pattern: {
          name: 'pass on (phrasal verb)',
          structure: 'pass + object + on + to + recipient',
          examples: [
            'I want to pass on my knowledge to the next generation',
            'She passed the message on to her colleagues',
          ],
        },
      },
      {
        id: 'G3',
        original: 'whereas spend more time',
        corrected: 'while also spending more time',
        category: 'conjunction_misuse',
        explanation: "'Whereas' shows contrast between two different things. Here you're describing two things happening at the same time, so 'while' is correct. The verb also needs a gerund form after 'while'.",
        context: "I'll still pursue my career, [whereas spend] more time and energy focusing on myself",
        grammar_pattern: {
          name: 'whereas vs while',
          structure: "'whereas' = contrast; 'while' = simultaneous actions or concession",
          examples: [
            "I prefer coffee, whereas she prefers tea (contrast)",
            "I'll work on my career while also spending time with family (simultaneous)",
          ],
        },
      },
      {
        id: 'G4',
        original: "if it's me in the past",
        corrected: 'if it were me in the past',
        category: 'subjunctive_errors',
        explanation: "When imagining an unreal or hypothetical situation, English uses the subjunctive: 'if it were' (not 'if it is/it's'). Same pattern as 'if I were you'.",
        context: "So, [if it's me in the past], I would like to say...",
        grammar_pattern: {
          name: 'If it were',
          structure: 'if + subject + were (not was/is)',
          examples: [
            'If I were you, I would accept the offer',
            'If it were up to me, I would change the policy',
            'I wish I were taller',
          ],
        },
      },
    ],
    positive: [],
  },

  // ── Session 2: Money Management ──────────────────────────────────────────
  {
    id: 'gloria_money_001',
    speaker: 'Gloria',
    topic: 'Money Management Habit',
    date: 'Apr 2026',
    transcript: `So I actually got a friend who is really good at manage her money. Um, I really want to develop this, uh, money skills cause before I'm kind of, I'm like, I have no concept about money.\n\nSo, um, for example, um, if I hang out with friends in the restaurant, we all gonna order the drinks even though there's nothing I want to drink, I'll still order one. But my friend, um, there was a time we hang out and had dinner after she checked the drink menu and she said, oh, um, there's nothing I want to drink so I will not order. And after that I just realise, I wasted a lot of my money on something that I don't really need and I don't actually want. Um, so that's a reason I want to develop this, um, good habit.\n\nThis is not about rich and poor, it's about, do you have a clear mind or like clear concept with money and how you gonna use it as a tool rather than let the money control you.\n\nShe also knows clearly about the, um, price of daily necessities like fruits, vegetables, um, tissues, paper towel like everything so you can tell when the price is going higher or um, is the price worth it when you buy the same thing at different places?`,
    errors: [
      {
        id: 'G1',
        original: 'I actually got a friend',
        corrected: 'I actually have a friend',
        category: 'verb_choice',
        explanation: "Use 'have' for existing relationships. 'Got' suggests you recently acquired the friend. For ongoing connections, use 'have'.",
        context: 'So [I actually got a friend] who is really good at',
        grammar_pattern: {
          name: 'Have vs got',
          structure: 'have = possess/ongoing; get = acquire/obtain',
          examples: [
            'I have a friend (existing relationship)',
            'I got a new friend last week (recently acquired)',
          ],
        },
      },
      {
        id: 'G2',
        original: 'good at manage her money',
        corrected: 'good at managing her money',
        category: 'verb_pattern',
        explanation: "After prepositions like 'at', always use the gerund (verb + -ing), never the base verb.",
        context: 'who is really [good at manage her money]',
        grammar_pattern: {
          name: '-ing after at / in / for',
          structure: 'after at / in / about / for / rather than, always use -ing',
          examples: [
            "good at managing (not 'manage')",
            "interested in learning (not 'learn')",
            "tired of waiting (not 'wait')",
          ],
        },
      },
      {
        id: 'G3',
        original: 'develop this, uh, money skills',
        corrected: 'develop these money skills',
        category: 'demonstrative_agreement',
        explanation: "Demonstratives must match the noun's number. 'Skills' is plural, so use 'these', not 'this'.",
        context: 'I really want to [develop this, uh, money skills]',
        grammar_pattern: {
          name: 'This / these',
          structure: 'this/that = singular · these/those = plural',
          examples: [
            'this skill (singular)',
            'these skills (plural)',
          ],
        },
      },
      {
        id: 'G4',
        original: 'we all gonna order',
        corrected: "we're all gonna order",
        category: 'verb_missing',
        explanation: "'Gonna' is informal for 'going to', but you still need the helping verb. Say 'we're all gonna order' or 'we will all order'.",
        context: '[we all gonna order] the drinks',
        grammar_pattern: {
          name: "Gonna needs 'are / is'",
          structure: "subject + am/is/are + gonna + verb",
          examples: [
            "we're gonna order (not 'we gonna')",
            "I'm gonna go (not 'I gonna')",
          ],
        },
      },
      {
        id: 'G5',
        original: 'order the drinks',
        corrected: 'order drinks',
        category: 'article_misuse',
        explanation: "When talking about drinks in general (not specific drinks already mentioned), don't use 'the'. Just say 'order drinks'.",
        context: 'we all gonna [order the drinks] even though',
      },
      {
        id: 'G6',
        original: 'the drink menu',
        corrected: 'the drinks menu',
        category: 'singular_plural',
        explanation: "A menu listing multiple drinks should be 'drinks menu' (plural), not 'drink menu'.",
        context: 'after she checked [the drink menu] and she said',
      },
      {
        id: 'G7',
        original: 'there was a time we hang out',
        corrected: 'there was a time we hung out',
        category: 'tense_consistency',
        explanation: "'There was a time' signals past tense, so use past tense 'hung out', not present 'hang out'.",
        context: '[there was a time we hang out] and had dinner',
      },
      {
        id: 'G8',
        original: 'after that I just realise',
        corrected: 'after that I just realised',
        category: 'tense_consistency',
        explanation: "You're narrating a past story, so use past tense 'realised', not present 'realise'.",
        context: '[after that I just realise], I wasted a lot of my money',
      },
      {
        id: 'G9',
        original: 'develop this, um, good habit',
        corrected: 'develop better financial habits',
        category: 'vague_reference',
        explanation: "'This good habit' is vague — what habit exactly? More specific: 'develop better financial habits' or 'get better with money'.",
        context: "that's a reason I want to [develop this, um, good habit]",
      },
      {
        id: 'G10',
        original: 'This is not about rich and poor',
        corrected: 'This is not about being rich or poor',
        category: 'parallel_structure',
        explanation: "For clarity and proper parallel structure, use 'being rich or poor' (gerund form). Don't use bare adjectives 'rich and poor'.",
        context: '[This is not about rich and poor], it\'s about',
        grammar_pattern: {
          name: 'parallel structure',
          structure: 'about being X or Y (gerund form)',
          examples: [
            'about being rich or poor',
            'between being young or being old',
          ],
        },
      },
      {
        id: 'G11',
        original: 'how you gonna use it',
        corrected: "how you're gonna use it",
        category: 'verb_missing',
        explanation: "Same pattern — 'gonna' needs the helping verb. Say 'how you're gonna use it' or 'how you will use it'.",
        context: '[how you gonna use it] as a tool',
        grammar_pattern: {
          name: "Gonna needs 'are / is'",
          structure: "subject + am/is/are + gonna + verb",
          examples: [
            "you're gonna use (not 'you gonna')",
            "she's gonna help (not 'she gonna')",
          ],
        },
      },
      {
        id: 'G12',
        original: 'rather than let the money control you',
        corrected: 'rather than letting money control you',
        category: 'verb_pattern',
        explanation: "Two issues: (1) After 'rather than', use the gerund 'letting', and (2) remove 'the' — use 'money' in general, not 'the money'.",
        context: '[rather than let the money control you]',
        grammar_pattern: {
          name: '-ing after at / in / for',
          structure: 'after at / in / about / for / rather than, always use -ing',
          examples: [
            "rather than letting (not 'let')",
            "good at managing (not 'manage')",
          ],
        },
      },
    ],
    positive: [
      {
        segment: 'how you gonna use it as a tool rather than let the money control you',
        feedback: "Excellent insight! The metaphor of money as a 'tool' vs 'controller' is sophisticated — very articulate thinking about personal finance.",
      },
      {
        segment: "I wasted a lot of my money on something that I don't really need and I don't actually want",
        feedback: "Strong self-awareness! The distinction between 'need' and 'want' shows thoughtful, honest reflection.",
      },
    ],
  },

  // ── Session 3: Movie — Flying Colours ───────────────────────────────────
  {
    id: 'gloria_movie_001',
    speaker: 'Gloria',
    topic: 'Book or Movie with Strong Impact',
    date: 'Apr 2026',
    transcript: `So this movie called Flying Colours, which was played by my head teacher of the class. Um, it's a very inspiring movie telling stories about, um, main character, Saika, who struggled with her schoolwork, only focus on beauty and just want to hang with friends all day in high school.\n\nSo, in this movie, one of her teacher looked down on her and don't believe, um, she can get in uni, so um she decided to prove herself like to everybody. And at the end of the story she get into one of the best uni in Japan, which is very inspiring and that's also why my head of teacher, uh, like my teacher want us to watch that in high school.\n\nBut the thing I learned from this movie is not about studying hard and dream comes true. Um, I learned something about friendship. So um, the plot when she wanna study hard because she's a hot girl and she also got hot friends. They always hang out with each other, but when she decide she want to study hard, um, her friend was very supportive.\n\nSometime like in Chinese high school, student kind of think study hard is awkward or embarrassed, so, um, they don't like nerds or like hardworking students. Um, if you say I'm gonna study hard you might got laughed at.\n\nSo in that movie, I realise real friends will support each other no matter what and people should not, um, mock someone who wanna improve and change.`,
    errors: [
      {
        id: 'G1',
        original: 'telling stories about, um, main character',
        corrected: 'telling stories about the main character',
        category: 'article_misuse',
        explanation: "When introducing a specific character (Saika), use 'the main character'. The article 'the' shows there is one specific main character in this story.",
        context: 'inspiring movie [telling stories about, um, main character], Saika',
      },
      {
        id: 'G2',
        original: 'only focus on beauty',
        corrected: 'only focused on beauty',
        category: 'tense_consistency',
        explanation: "You're telling a past story about the movie, so use past tense 'focused'.",
        context: 'who struggled with her schoolwork, [only focus on beauty]',
      },
      {
        id: 'G3',
        original: 'just want to hang with friends all day',
        corrected: 'just wanted to hang out with her friends all day',
        category: 'tense_consistency',
        explanation: "Two issues: (1) Use past tense 'wanted' to match the story, and (2) complete the phrasal verb: 'hang out' not just 'hang'.",
        context: '[just want to hang with friends all day] in high school',
      },
      {
        id: 'G4',
        original: 'one of her teacher',
        corrected: 'one of her teachers',
        category: 'singular_plural',
        explanation: "After 'one of', always use a plural noun. You're selecting one person from a group of teachers.",
        context: '[one of her teacher] looked down on her',
        grammar_pattern: {
          name: 'One of + plural',
          structure: 'one of + the/my/her + plural noun',
          examples: [
            "one of her teachers (not 'teacher')",
            "one of my friends (not 'friend')",
            "one of the best universities",
          ],
        },
      },
      {
        id: 'G5',
        original: "looked down on her and don't believe",
        corrected: "looked down on her and didn't believe",
        category: 'tense_consistency',
        explanation: "'Looked' is past, so 'don't' should be 'didn't' to keep consistent past tense.",
        context: "[looked down on her and don't believe], um, she can",
      },
      {
        id: 'G6',
        original: 'she can get in uni',
        corrected: 'she could get into uni',
        category: 'tense_consistency',
        explanation: "In a past context, use 'could' not 'can'. Also use the phrasal verb 'get into' for entering university, not 'get in'.",
        context: "don't believe [she can get in uni]",
      },
      {
        id: 'G7',
        original: 'she get into one of the best uni',
        corrected: 'she got into one of the best unis',
        category: 'subject_verb_agreement',
        explanation: "Two issues: (1) use past tense 'got', and (2) 'uni' is countable — use plural 'unis' after 'one of the best'.",
        context: '[she get into one of the best uni] in Japan',
      },
      {
        id: 'G8',
        original: 'my teacher want us to watch',
        corrected: 'my teacher wanted us to watch',
        category: 'tense_consistency',
        explanation: "You're talking about the past (high school), so use past tense 'wanted', not present 'want'.",
        context: '[my teacher want us to watch] that in high school',
      },
      {
        id: 'G9',
        original: 'studying hard and dream comes true',
        corrected: 'studying hard and dreams coming true',
        category: 'parallel_structure',
        explanation: "Keep parallel structure: both should be gerund phrases. 'Studying hard' is already a gerund, so use 'dreams coming true' to match.",
        context: 'is not about [studying hard and dream comes true]',
        grammar_pattern: {
          name: 'Parallel structure',
          structure: 'verb-ing and verb-ing (keep same form)',
          examples: [
            'studying hard and working smart',
            'dreams coming true (gerund phrase)',
          ],
        },
      },
      {
        id: 'G10',
        original: 'when she wanna study hard',
        corrected: 'when she decided she wanted to study hard',
        category: 'verb_choice',
        explanation: "'Wanna' (want to) is too casual here, and past tense is needed. Better: 'when she decided she wanted to study hard' (shows the decision moment).",
        context: 'the plot [when she wanna study hard] because she\'s a hot girl',
      },
      {
        id: 'G11',
        original: 'when she decide she want to study hard',
        corrected: 'when she decided she wanted to study hard',
        category: 'tense_consistency',
        explanation: "Both verbs need past tense: 'decided' (not 'decide') and 'wanted' (not 'want').",
        context: 'but [when she decide she want to study hard], um, her friend',
      },
      {
        id: 'G12',
        original: 'student kind of think study hard is awkward or embarrassed',
        corrected: 'students kind of think studying hard is awkward or embarrassing',
        category: 'singular_plural',
        explanation: "Three issues: (1) use plural 'students', (2) use gerund 'studying hard' as the subject, and (3) use 'embarrassing' (describes the activity) not 'embarrassed' (how a person feels).",
        context: 'in Chinese high school, [student kind of think study hard is awkward or embarrassed]',
        grammar_pattern: {
          name: 'embarrassing vs embarrassed',
          structure: '-ing = describes the thing; -ed = describes the feeling',
          examples: [
            'studying is embarrassing (the activity itself)',
            'I feel embarrassed (my feeling)',
            'the movie is boring · I am bored',
          ],
        },
      },
      {
        id: 'G13',
        original: 'you might got laughed at',
        corrected: 'you might get laughed at',
        category: 'modal_verb_pattern',
        explanation: "After modal verbs (might, could, should), always use the base form. Use 'get' (base), not 'got' (past).",
        context: '[you might got laughed at]',
        grammar_pattern: {
          name: 'Might / could + base verb',
          structure: 'modal verb + base form (not past tense)',
          examples: [
            "might get (not 'might got')",
            "could see (not 'could saw')",
            "should go (not 'should went')",
          ],
        },
      },
      {
        id: 'G14',
        original: 'in that movie, I realise',
        corrected: 'in that movie, I realised',
        category: 'tense_consistency',
        explanation: "You're talking about when you watched the movie (past), so use past tense 'realised', not 'realise'.",
        context: 'So [in that movie, I realise] real friends will support',
      },
      {
        id: 'G15',
        original: 'mock someone who wanna improve',
        corrected: 'mock people who want to improve',
        category: 'word_choice',
        explanation: "Use 'people' or 'others' instead of 'someone' for general statements. Also use 'want' instead of casual 'wanna' in this context.",
        context: 'people should not, um, [mock someone who wanna improve] and change',
      },
    ],
    positive: [
      {
        segment: 'the thing I learned from this movie is not about studying hard and dream comes true. Um, I learned something about friendship.',
        feedback: "Excellent critical thinking! Instead of taking the obvious lesson, you found a deeper meaning about friendship — this shows sophisticated analysis.",
      },
      {
        segment: 'in Chinese high school, student kind of think study hard is awkward or embarrassed, so they don\'t like nerds or like hardworking students',
        feedback: "Great cultural observation! You explained the social pressure clearly with specific examples, which adds real depth to your point.",
      },
    ],
  },
];
