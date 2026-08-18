export const dailyLesson = [
  {
    title: 'Rozcvička',
    detail: '3 slovíčka',
    minutes: 2,
    action: 'Dokončit rozcvičku',
  },
  {
    title: 'Jedna myšlenka',
    detail: 'slovosled ve větě',
    minutes: 2,
    action: 'Dokončit jednu myšlenku',
  },
  {
    title: 'Použij ji',
    detail: 'krátká vlastní věta',
    minutes: 1,
    action: 'Použít vlastní větu',
  },
] as const;

export const totalLessonMinutes = dailyLesson.reduce((total, step) => total + step.minutes, 0);
