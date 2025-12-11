export const questionsByCategory = {
  "Parent-Child": [
    "What's one family tradition you hope to continue?",
    "When did you feel most proud of me recently?",
    "What was your biggest worry as a teenager?",
    "What's something you wish you could tell your younger self?",
    "What family story do you think I should know?",
    "How have you grown as a person since becoming a parent?",
    "What's one thing you hope I remember about our relationship?",
    "What was the most challenging part of your childhood?",
    "What do you think our family does really well together?",
    "What's a mistake you made that taught you something important?",
    "What are you most excited about for my future?",
    "What values do you hope I carry with me through life?",
  ],
  
  "Romantic Partners": [
    "What's one dream we haven't talked about yet?",
    "When do you feel most connected to me?",
    "What's something small I do that makes you smile?",
    "How have you grown since we've been together?",
    "What's your favorite memory of us from this year?",
    "What do you need more of in our relationship?",
    "What's something you're grateful for about our partnership?",
    "How do you see our relationship evolving in the future?",
    "What's one way I can better support your dreams?",
    "What challenge are you facing that I might not know about?",
    "What adventure do you want us to take together?",
    "What about our relationship surprises you most?",
  ],

  "Friends": [
    "What's one thing you've learned about yourself this year?",
    "If you could time travel, what period would you visit?",
    "What's the best advice someone has given you lately?",
    "What's something you're working on that excites you?",
    "What's a fear you've been trying to overcome?",
    "Who has influenced you the most recently and why?",
    "What's your biggest hope for the next five years?",
    "What's something you want to try but haven't yet?",
    "What book or movie has changed your perspective lately?",
    "What's the most meaningful compliment you've received?",
    "What tradition or ritual makes you feel grounded?",
    "What's one thing you wish people understood about you?",
  ],

  "Siblings": [
    "What's your favorite childhood memory of us together?",
    "How has our relationship changed as we've grown up?",
    "What do you think I'm really good at?",
    "What family trait do you think we both inherited?",
    "What's something you always admired about me?",
    "How do you think we're similar and different?",
    "What role did I play in your childhood?",
    "What's a lesson you learned from watching me?",
    "What do you hope our relationship looks like in 10 years?",
    "What family story always makes you laugh?",
    "What's something you want to tell our future kids about growing up together?",
    "What support do you need from me right now?",
  ],

  "Grandparents": [
    "What was the world like when you were my age?",
    "What's the most important lesson life has taught you?",
    "What's something you want me to always remember?",
    "What was your favorite thing about being young?",
    "What change have you seen that amazes you most?",
    "What wisdom do you wish you could pass on to everyone?",
    "What's your proudest moment as a grandparent?",
    "What tradition from your childhood do you miss?",
    "What do you hope I learn that you had to figure out the hard way?",
    "What's the best decision you ever made?",
    "What do you want your legacy to be?",
    "What story about our family should never be forgotten?",
  ],

  "Long-distance": [
    "What's something beautiful you saw today?",
    "If I were there right now, what would we do?",
    "What's one thing that reminded you of me this week?",
    "What's your favorite memory of us when we were last together?",
    "What are you most looking forward to when we see each other next?",
    "What's something happening in your daily life that I'd find interesting?",
    "How has being apart changed how you think about our relationship?",
    "What's a small moment from your day you want to share with me?",
    "What's something you wish I could experience with you right now?",
    "What song or movie made you think of me recently?",
    "What's one thing you appreciate about me more because of the distance?",
    "What dream do you have about our future together?",
  ],

  "Other": [
    "What's something you've been thinking about lately?",
    "What's bringing you joy right now?",
    "What challenge are you facing that you'd like support with?",
    "What's something you're grateful for today?",
    "What's a goal you're working toward?",
    "What's something you wish more people knew about you?",
    "What's the most interesting thing you've learned recently?",
    "What's a value that's important to you and why?",
    "What's something that always makes you feel better?",
    "What's a question you've been asking yourself?",
    "What's something you want to get better at?",
    "What's a memory that always makes you smile?",
  ],
};

export function getQuestionsByCategory(category: string): string[] {
  return questionsByCategory[category as keyof typeof questionsByCategory] || questionsByCategory["Other"];
}

export function getRandomQuestion(category: string): string {
  const questions = getQuestionsByCategory(category);
  return questions[Math.floor(Math.random() * questions.length)];
}
