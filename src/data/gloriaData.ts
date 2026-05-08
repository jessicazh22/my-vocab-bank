import type { GrammarErrorCategory } from '../lib/grammar';

export interface GrammarErrorData {
  id: string;
  original: string;
  corrected: string;
  category: GrammarErrorCategory;
  explanation: string;
  explanation_zh?: string;
  context: string;
  grammar_pattern?: {
    name: string;
    name_zh?: string;
    structure: string;
    structure_zh?: string;
    examples: string[];
    examples_zh?: string[];
  };
  practice_sentences?: Array<{
    id: string;
    text: string;
    corrected: string;
  }>;
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
        grammar_pattern: {
          name: 'Preposition (on / in / at)',
          structure: 'on a (daily/weekly/regular/hourly) basis',
          examples: [
            'We meet on a weekly basis',
            'She exercises on a regular basis',
            'They check progress on a monthly basis',
          ],
        },
        practice_sentences: [
          {
            id: 'p1',
            text: 'I work in a daily basis to improve my skills.',
            corrected: 'I work on a daily basis to improve my skills.',
          },
          {
            id: 'p2',
            text: 'The team meets in a weekly basis to discuss projects.',
            corrected: 'The team meets on a weekly basis to discuss projects.',
          },
          {
            id: 'p3',
            text: 'She studies in a regular basis for her exams.',
            corrected: 'She studies on a regular basis for her exams.',
          },
          {
            id: 'p4',
            text: 'They review the data in a monthly basis.',
            corrected: 'They review the data on a monthly basis.',
          },
        ],
      },
      {
        id: 'G2',
        original: 'pass my values to people to this society',
        corrected: 'pass my values on to people in this society',
        category: 'preposition_errors',
        explanation: "Two issues: (1) The phrasal verb is 'pass something ON to someone' — use 'on' after 'pass'. (2) People live 'IN' a society, not 'to' a society.",
        context: 'I wanna [pass my values to people to this society] through my career',
        grammar_pattern: {
          name: 'Preposition (on / in / at)',
          structure: 'on a (daily/weekly/regular/hourly) basis; pass on; live in',
          examples: [
            'We meet on a weekly basis',
            'I want to pass on my knowledge',
            'People live in this society',
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
        practice_sentences: [
          {
            id: 'p1',
            text: 'If I was you, I would take that job offer.',
            corrected: 'If I were you, I would take that job offer.',
          },
          {
            id: 'p2',
            text: 'If it was possible, she would travel around the world.',
            corrected: 'If it were possible, she would travel around the world.',
          },
          {
            id: 'p3',
            text: 'If I was in your situation, I would make a different choice.',
            corrected: 'If I were in your situation, I would make a different choice.',
          },
          {
            id: 'p4',
            text: 'I wish I was taller so I could play basketball.',
            corrected: 'I wish I were taller so I could play basketball.',
          },
        ],
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
        explanation_zh: '在 at 等介词后面，必须用动名词(-ing 形式)，不能用原型动词。',
        context: 'who is really [good at manage her money]',
        grammar_pattern: {
          name: '-ing after at / in / for',
          name_zh: '介词后用 -ing 形式',
          structure: 'after at / in / about / for / rather than, always use -ing',
          structure_zh: 'at / in / about / for / rather than 后面，总是用 -ing 形式',
          examples: [
            "good at managing (not 'manage')",
            "interested in learning (not 'learn')",
            "tired of waiting (not 'wait')",
          ],
          examples_zh: [
            '擅长管理(good at managing)',
            '对学习感兴趣(interested in learning)',
            '厌倦等待(tired of waiting)',
          ],
        },
        practice_sentences: [
          {
            id: 'p1',
            text: 'She is very good at cook delicious meals.',
            corrected: 'She is very good at cooking delicious meals.',
          },
          {
            id: 'p2',
            text: 'I am interested in learn new languages.',
            corrected: 'I am interested in learning new languages.',
          },
          {
            id: 'p3',
            text: 'Are you tired of work so hard every day?',
            corrected: 'Are you tired of working so hard every day?',
          },
          {
            id: 'p4',
            text: 'He is not good at communicate with strangers.',
            corrected: 'He is not good at communicating with strangers.',
          },
        ],
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
        explanation_zh: '"Gonna" 需要加上 am/is/are。比如：we\'re gonna (不能说 we gonna)。',
        context: '[we all gonna order] the drinks',
        grammar_pattern: {
          name: "Gonna needs 'are / is'",
          name_zh: "Gonna 前要加 am/is/are",
          structure: "subject + am/is/are + gonna + verb",
          structure_zh: "主语 + am/is/are + gonna + 动词",
          examples: [
            "we're gonna order (not 'we gonna')",
            "I'm gonna go (not 'I gonna')",
          ],
          examples_zh: [
            "我们要点菜(we're gonna order)",
            "我要去(I'm gonna go)",
          ],
        },
        practice_sentences: [
          {
            id: 'p1',
            text: 'They gonna help us finish the project.',
            corrected: "They're gonna help us finish the project.",
          },
          {
            id: 'p2',
            text: 'You gonna like this restaurant.',
            corrected: "You're gonna like this restaurant.",
          },
          {
            id: 'p3',
            text: 'She gonna visit her parents next week.',
            corrected: "She's gonna visit her parents next week.",
          },
          {
            id: 'p4',
            text: 'I gonna call you tomorrow.',
            corrected: "I'm gonna call you tomorrow.",
          },
        ],
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
        explanation_zh: '讲过去的故事要用过去时。比如：I realised (不能用 I realise)。',
        context: '[after that I just realise], I wasted a lot of my money',
        grammar_pattern: {
          name: 'Past tense',
          name_zh: '过去时',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          structure_zh: '讲故事的时候保持过去时：was, went, realised, had',
          examples: [
            'I realised I made a mistake',
            'She was very sad when I left',
            'He went to the store and bought milk',
          ],
          examples_zh: [
            '我意识到我犯了错误(I realised)',
            '她看到我离开时很伤心(She was)',
            '他去商店买了牛奶(went, bought)',
          ],
        },
        practice_sentences: [
          {
            id: 'p1',
            text: 'When I see that movie, I feel very sad.',
            corrected: 'When I saw that movie, I felt very sad.',
          },
          {
            id: 'p2',
            text: 'Last year, he travels to three countries.',
            corrected: 'Last year, he travelled to three countries.',
          },
          {
            id: 'p3',
            text: 'She tells me that she loses her keys.',
            corrected: 'She told me that she had lost her keys.',
          },
          {
            id: 'p4',
            text: 'We are very tired when we finish the project.',
            corrected: 'We were very tired when we finished the project.',
          },
        ],
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
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'She focused on beauty (past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
      },
      {
        id: 'G3',
        original: 'just want to hang with friends all day',
        corrected: 'just wanted to hang out with her friends all day',
        category: 'tense_consistency',
        explanation: "Two issues: (1) Use past tense 'wanted' to match the story, and (2) complete the phrasal verb: 'hang out' not just 'hang'.",
        context: '[just want to hang with friends all day] in high school',
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'She wanted to hang out (past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
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
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'She looked and believed (consistent past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
      },
      {
        id: 'G6',
        original: 'she can get in uni',
        corrected: 'she could get into uni',
        category: 'tense_consistency',
        explanation: "In a past context, use 'could' not 'can'. Also use the phrasal verb 'get into' for entering university, not 'get in'.",
        context: "don't believe [she can get in uni]",
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'She could get into uni (past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
      },
      {
        id: 'G7',
        original: 'she get into one of the best uni',
        corrected: 'she got into one of the best unis',
        category: 'tense_consistency',
        explanation: "Two issues: (1) use past tense 'got' to match the past story context, and (2) 'uni' is countable — use plural 'unis' after 'one of the best'.",
        context: '[she get into one of the best uni] in Japan',
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'She got into one of the best unis (past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
        practice_sentences: [
          {
            id: 'p1',
            text: 'Last year, she get into a top university in England.',
            corrected: 'Last year, she got into a top university in England.',
          },
          {
            id: 'p2',
            text: 'When he apply to universities, he get accepted by three schools.',
            corrected: 'When he applied to universities, he got accepted by three schools.',
          },
          {
            id: 'p3',
            text: 'She work hard and then she get the job she want.',
            corrected: 'She worked hard and then she got the job she wanted.',
          },
          {
            id: 'p4',
            text: 'They finally get the best results after years of studying.',
            corrected: 'They finally got the best results after years of studying.',
          },
        ],
      },
      {
        id: 'G8',
        original: 'my teacher want us to watch',
        corrected: 'my teacher wanted us to watch',
        category: 'tense_consistency',
        explanation: "You're talking about the past (high school), so use past tense 'wanted', not present 'want'.",
        context: '[my teacher want us to watch] that in high school',
        grammar_pattern: {
          name: 'Past tense',
          structure: 'When telling a past story, keep past tense: was, went, realised, had',
          examples: [
            'My teacher wanted to watch (past tense)',
            'He went to the university yesterday',
            'They realized their mistake',
          ],
        },
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

  // ── Session 4 & 5: Neuroscience & Anxiety Management (May 1) ────────────────
  // Part 1 — original speech
  {
    id: 'gloria_anxiety_001',
    speaker: 'Gloria',
    topic: 'Neuroscience & Anxiety Management',
    date: 'May 2026',
    transcript: `So the way that neuroscience told us how to properly treat the anxiety is that, for as the first step, we can write the specific questions about your anxiety in a notebook. In the neuroscience, we call it cognitive offloading. It's basically like you remove the information in your brain using the external tools.\n\nI can give you two examples of cognitive offloading:\n\n1. We choose to use a scheduling app or Apple Calendar to record our schedule or take a note of what we need to do. That's one example of cognitive offloading.\n\n2. Another example is when you use a map. Sometimes your phone map is not the same direction as you're in real life. When you choose to stir the map on the phone to match your real physical direction, that's also called cognitive offloading. Rather than imagine the direction in your mind, you choose to stir the map.\n\nWhat we need to do about anxiety:\n\nYou need a notebook.\n\nYou need to pick a spot at your home. It should not be your bed or your working table or your dining table, because those three spots are where you relax, work, and have fun. You don't want to use those three spots. You can pick another corner or another spot to sit or lying down, and you write your anxiety in your notebook in that spot.\n\nThe second step would be you want picking a specific time slot to release your anxiety. You want a regular schedule, and when anxiety comes up, you can quickly write that down in your notebook and keep having deep thinking. If you think that anxiety needs deep writing, you're still using the same spot and—`,
    errors: [
      {
        id: 'G1',
        original: 'neuroscience told us',
        corrected: 'neuroscience taught us',
        category: 'verb_choice',
        explanation: "'Teach' is the correct verb when someone transfers knowledge or a skill. 'Tell' is for information or commands. Neuroscience teaches us — it doesn't tell us.",
        context: 'the way that [neuroscience told us] how to properly treat',
        grammar_pattern: {
          name: 'Tell vs teach',
          structure: 'teach = transfer knowledge/skill · tell = give information or a command',
          examples: [
            'Neuroscience taught us how the brain works',
            'She taught me how to cook (skill transfer)',
            'He told me the answer (information)',
          ],
        },
      },
      {
        id: 'G2',
        original: 'treat the anxiety',
        corrected: 'treat anxiety',
        category: 'article_misuse',
        explanation: "When referring to anxiety as a general condition or concept, don't use 'the'. 'The anxiety' implies a specific anxiety already mentioned.",
        context: 'how to properly [treat the anxiety]',
      },
      {
        id: 'G3',
        original: 'for as the first step',
        corrected: 'as the first step',
        category: 'preposition_errors',
        explanation: "'For' doesn't fit here. Use 'as the first step' to introduce a step in a sequence.",
        context: 'it is that, [for as the first step], we can write',
      },
      {
        id: 'G4',
        original: 'In the neuroscience',
        corrected: 'In neuroscience',
        category: 'article_misuse',
        explanation: "Academic fields and disciplines don't take 'the'. Say 'In neuroscience', 'In psychology', 'In medicine'.",
        context: '[In the neuroscience], we call it cognitive offloading',
        grammar_pattern: {
          name: 'No article with fields of study',
          structure: 'In + [field] (no article)',
          examples: [
            'In neuroscience, we study the brain',
            'In psychology, this is called cognitive bias',
            'In medicine, this is a common treatment',
          ],
        },
      },
      {
        id: 'G5',
        original: 'using the external tools',
        corrected: 'using external tools',
        category: 'article_misuse',
        explanation: "When referring to external tools in general (not specific tools already introduced), omit 'the'.",
        context: 'you remove the information in your brain [using the external tools]',
      },
      {
        id: 'G6',
        original: 'rather than imagine the direction',
        corrected: 'rather than imagining the direction',
        category: 'verb_pattern',
        explanation: "After 'rather than', use the gerund (-ing form), not the base verb.",
        context: '[Rather than imagine the direction] in your mind',
        grammar_pattern: {
          name: '-ing after rather than',
          structure: 'rather than + verb-ing (not base verb)',
          examples: [
            'rather than imagining (not imagine)',
            'rather than waiting (not wait)',
            'rather than giving up (not give up)',
          ],
        },
      },
      {
        id: 'G7',
        original: 'your working table',
        corrected: 'your work table',
        category: 'word_form',
        explanation: "'Work table' uses 'work' as an adjective meaning 'for working'. 'Working' would imply the table itself is doing something.",
        context: 'your bed or [your working table] or your dining table',
      },
      {
        id: 'G8',
        original: 'you want picking a specific time slot',
        corrected: 'you want to pick a specific time slot',
        category: 'verb_pattern',
        explanation: "After 'want', always use the infinitive (to + verb), not the gerund. Say 'want to pick', not 'want picking'.",
        context: 'The second step would be [you want picking a specific time slot]',
        grammar_pattern: {
          name: 'Want + infinitive',
          structure: 'want + to + base verb (not want + -ing)',
          examples: [
            'want to pick (not want picking)',
            'want to go (not want going)',
            'want to improve (not want improving)',
          ],
        },
      },
      {
        id: 'G9',
        original: 'to release your anxiety',
        corrected: 'to process your anxiety',
        category: 'word_choice',
        explanation: "'Release' suggests letting something go in a sudden burst. For anxiety, 'process' is more accurate — it means working through and understanding it over time.",
        context: 'a specific time slot [to release your anxiety]',
      },
      {
        id: 'G10',
        original: 'keep having deep thinking',
        corrected: 'keep thinking deeply',
        category: 'verb_pattern',
        explanation: "'Keep' is followed by a gerund directly, not 'having + noun'. Restructure: 'keep thinking deeply' rather than 'keep having deep thinking'.",
        context: 'write that down in your notebook and [keep having deep thinking]',
      },
      {
        id: 'G11',
        original: 'take a note of what we need to do',
        corrected: 'take note of what we need to do',
        category: 'article_misuse',
        explanation: "'Take note' (no article) is the fixed expression meaning to pay attention or make a mental record. 'Take a note' means to physically write something down — not the intended meaning here.",
        context: 'record our schedule or [take a note of what we need to do]',
      },
      {
        id: 'G12',
        original: "your phone map is not the same direction as you're in real life",
        corrected: "your phone map is not showing the same direction as you're facing in real life",
        category: 'sentence_structure',
        explanation: "Two issues: (1) 'not the same direction as you're in real life' is grammatically broken — use 'not showing the same direction as you're facing'. (2) 'in real life' should be 'in real life' ✓ but the verb 'showing' is missing.",
        context: "Sometimes [your phone map is not the same direction as you're in real life]",
      },
      {
        id: 'G13',
        original: 'stir the map on the phone',
        corrected: 'turn the map on the phone',
        category: 'word_choice',
        explanation: "'Stir' is for mixing liquids. The correct verb for rotating a map is 'turn'. Both instances in this passage use 'stir' where 'turn' is needed.",
        context: 'When you choose to [stir the map on the phone] to match your real physical direction',
      },
      {
        id: 'G14',
        original: 'you choose to stir the map',
        corrected: 'you choose to turn the map',
        category: 'word_choice',
        explanation: "Same error as above — 'stir' is for mixing, 'turn' is for rotating. Use 'turn the map'.",
        context: 'Rather than imagine the direction in your mind, [you choose to stir the map]',
      },
      {
        id: 'G15',
        original: 'to sit or lying down',
        corrected: 'to sit or lie down',
        category: 'parallel_structure',
        explanation: "Both options must be in the same form. 'Sit' is an infinitive (after 'to'), so the second verb must also be an infinitive: 'lie down', not the gerund 'lying down'.",
        context: 'You can pick another spot [to sit or lying down]',
        grammar_pattern: {
          name: 'Parallel structure with infinitives',
          structure: 'to + verb or verb (not to + verb or verb-ing)',
          examples: [
            'to sit or lie down (not lying down)',
            'to read or write (not writing)',
            'to run or walk (not walking)',
          ],
        },
      },
    ],
    positive: [],
  },

  // Part 2 — Gloria's self-correction attempt
  {
    id: 'gloria_anxiety_002',
    speaker: 'Gloria',
    topic: 'Neuroscience & Anxiety Management',
    date: 'May 2026',
    transcript: `Those neuroscience are very interesting. A type of neuroscience. As for the first step, we need to know that anxiety is a normal, physical reaction that we can deal with it. It's like your emotional trash or poop. What we need to prepare is your notebook that you can write your specific questions that you're anxious about. In the second step, you need to pick a spot or place at home. It should not be your bed, study table or dining table because those three places are where you relax, work, study, or have fun.\n\nThe third step is that you picking a timeslot. So every day or every week, you wanna write down what you're anxious about your anxiety in the same time and same spot.\n\nThe first example is using a scheduling app like Apple or Google Calendar. We don't have to remember all of those events or activities, but instead choose to record them using external tools.\n\nAnother one would be using the map on the phone. Sometimes it shows the wrong direction as we're in the real world. Sometimes when I say it, I know it's not making sense. Doesn't make sense don't. How I use it in the real context.`,
    errors: [
      {
        id: 'G1',
        original: 'Those neuroscience are very interesting',
        corrected: 'Neuroscience is very interesting',
        category: 'uncountable_noun',
        explanation: "'Neuroscience' is uncountable — it can't be pluralised or preceded by 'those'. Use the singular verb 'is'.",
        context: '[Those neuroscience are very interesting]',
        grammar_pattern: {
          name: 'Uncountable nouns',
          structure: 'Uncountable noun + is (never those/these or are)',
          examples: [
            'Neuroscience is fascinating (not those neuroscience are)',
            'Psychology is complex',
            'Information is available online',
          ],
        },
      },
      {
        id: 'G2',
        original: 'a type of neuroscience',
        corrected: 'these fields in neuroscience',
        category: 'vague_reference',
        explanation: "'A type of neuroscience' is vague — which type? If you mean the broader topic, say 'these fields in neuroscience' or 'this area of neuroscience'.",
        context: '[A type of neuroscience]. As for the first step',
      },
      {
        id: 'G3',
        original: 'we can deal with it',
        corrected: 'we can deal with',
        category: 'redundant_words',
        explanation: "In the relative clause 'a reaction that we can deal with', the 'it' at the end is redundant — the clause already refers back to 'reaction'.",
        context: 'a normal, physical reaction that [we can deal with it]',
      },
      {
        id: 'G4',
        original: 'notebook that you can write',
        corrected: 'notebook where you can write',
        category: 'pronoun_form',
        explanation: "Use 'where' (not 'that') when the relative clause refers to a place. A notebook is a place where you write.",
        context: 'your [notebook that you can write] your specific questions',
        grammar_pattern: {
          name: 'Where vs that for places',
          structure: 'place + where + clause (not that)',
          examples: [
            'a notebook where you can write (not that you can write)',
            'a spot where you sit',
            'a place where you feel calm',
          ],
        },
      },
      {
        id: 'G5',
        original: 'The third step is that you picking a timeslot',
        corrected: 'The third step is to pick a timeslot',
        category: 'verb_pattern',
        explanation: "After 'is', use the infinitive to describe what a step involves. 'Is that you picking' mixes two structures incorrectly.",
        context: '[The third step is that you picking a timeslot]',
        grammar_pattern: {
          name: 'Is + infinitive for steps',
          structure: 'The [step] is + to + base verb',
          examples: [
            'The third step is to pick a timeslot',
            'The goal is to write down your anxiety',
            'The idea is to use external tools',
          ],
        },
      },
      {
        id: 'G6',
        original: 'in the same time and same spot',
        corrected: 'at the same time and in the same spot',
        category: 'preposition_errors',
        explanation: "Use 'at' for a point in time ('at the same time') and 'in' for a physical space ('in the same spot').",
        context: 'write down your anxiety [in the same time and same spot]',
        grammar_pattern: {
          name: 'At for time, in for place',
          structure: 'at + time expression · in + place/space',
          examples: [
            'at the same time (not in the same time)',
            'in the same spot (correct)',
            'at 9am · in the corner',
          ],
        },
      },
      {
        id: 'G7',
        original: 'instead choose to record',
        corrected: 'instead of choosing to record',
        category: 'verb_pattern',
        explanation: "After 'instead of', use the gerund (-ing). 'Instead choose' leaves out the 'of' and uses the wrong verb form.",
        context: 'but [instead choose to record] them using external tools',
      },
      {
        id: 'G8',
        original: 'using the map on the phone',
        corrected: 'using a map on the phone',
        category: 'article_misuse',
        explanation: "When mentioning a map for the first time in general, use 'a', not 'the'. 'The map' implies a specific map already known to both speakers.",
        context: 'Another one would be [using the map on the phone]',
      },
      {
        id: 'G9',
        original: "it shows the wrong direction as we're in the real world",
        corrected: "it shows a different direction to where we're facing in the real world",
        category: 'sentence_structure',
        explanation: "Two issues: (1) 'wrong direction as we're in' is grammatically broken — use 'different direction to where we're facing'. (2) 'a different direction' is more natural than 'the wrong direction' here.",
        context: "Sometimes [it shows the wrong direction as we're in the real world]",
      },
      {
        id: 'G10',
        original: "it's not making sense",
        corrected: "it doesn't make sense",
        category: 'verb_form',
        explanation: "For permanent truths or general observations, use simple present ('doesn't make sense'), not the progressive ('isn't making sense'). The progressive suggests a temporary, in-progress action.",
        context: "I know [it's not making sense]",
        grammar_pattern: {
          name: 'Simple vs progressive for general truths',
          structure: 'Simple present for facts/general truths · progressive for temporary actions',
          examples: [
            "it doesn't make sense (general truth, not 'isn't making sense')",
            "Water boils at 100°C (not 'is boiling')",
            "She works in finance (permanent job, not 'is working')",
          ],
        },
      },
      {
        id: 'G11',
        original: "doesn't make sense don't",
        corrected: "doesn't make sense",
        category: 'subject_verb_agreement',
        explanation: "The subject 'it' needs 'doesn't', not 'don't'. 'Don't' is for I/you/we/they. 'Doesn't' is for he/she/it.",
        context: "[doesn't make sense don't]",
        grammar_pattern: {
          name: "Don't vs doesn't",
          structure: "I/you/we/they + don't · he/she/it + doesn't",
          examples: [
            "It doesn't make sense (not don't)",
            "She doesn't understand",
            "They don't know",
          ],
        },
      },
      {
        id: 'G12',
        original: 'how I use it in the real context',
        corrected: 'how I use this in a real context',
        category: 'pronoun_form',
        explanation: "Two issues: (1) Use 'this' (not 'it') to refer back to the technique just explained. (2) 'A real context' (not 'the real context') — no specific context has been introduced yet.",
        context: '[how I use it in the real context]',
      },
      {
        id: 'G13',
        original: 'As for the first step',
        corrected: 'As the first step',
        category: 'preposition_errors',
        explanation: "'As for' introduces a change of topic ('As for the next point...'). To list a step in a sequence, just use 'As the first step' — drop 'for'.",
        context: '[As for the first step], we need to know that anxiety is a normal reaction',
      },
    ],
    positive: [],
  },
];
