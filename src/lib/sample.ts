import type { ResumeDocument } from "./types";

/** Example shown on the landing page (fictional person). */
export const SAMPLE: ResumeDocument = {
  meta: {
    id: "sample",
    updatedAt: "",
    template: "modern",
    theme: "deep_navy",
    tone: "modern",
  },
  personal: {
    photoRatio: "1:1",
    fullName: "Анна Смирнова",
    targetTitle: "Продуктовый аналитик",
    birthDate: "1992-04-12",
    showAge: true,
    location: "Москва",
  },
  contacts: {
    phone: "+7 (916) 123-45-67",
    email: "anna@example.ru",
    telegram: "@anna_sm",
    linkedin: "linkedin.com/in/anna-smirnova",
    portfolioUrl: "anna-analytics.ru",
  },
  aiGenerated: {
    summary:
      "Продуктовый аналитик с 6 годами опыта в e-commerce и финтехе. Строю метрики продукта, провожу A/B-тесты и помогаю командам принимать решения на данных. Сократила отток на 12% и ускорила отчётность в 3 раза.",
    keyStrengths: [
      {
        title: "A/B-тесты",
        description:
          "Дизайн экспериментов, расчёт мощности, интерпретация для бизнеса",
      },
      {
        title: "Метрики продукта",
        description: "Дерево метрик, юнит-экономика, когортный анализ",
      },
      {
        title: "Автоматизация отчётности",
        description: "Airflow, dbt и дашборды вместо ручных выгрузок",
      },
      {
        title: "Коммуникация",
        description:
          "Объясняю выводы менеджерам и разработчикам простым языком",
      },
    ],
  },
  experience: [
    {
      id: "e1",
      company: "Ozon",
      position: "Старший продуктовый аналитик",
      startDate: "2022-03",
      isCurrent: true,
      rawNotes: "",
      aiBullets: [
        "Запустила систему A/B-тестов для 4 продуктовых команд; время на эксперимент сократилось с 3 недель до 8 дней",
        "Построила дерево метрик корзины и нашла причину падения конверсии на 2,1 п. п.",
        "Автоматизировала еженедельную отчётность в Airflow и dbt, освободив 10 часов в неделю",
      ],
    },
    {
      id: "e2",
      company: "Тинькофф",
      position: "Аналитик данных",
      startDate: "2019-06",
      endDate: "2022-02",
      isCurrent: false,
      rawNotes: "",
      aiBullets: [
        "Разработала модель оттока клиентов, которая помогла снизить отток на 12%",
        "Провела 40+ A/B-тестов в мобильном приложении",
        "Наставничала двух младших аналитиков",
      ],
    },
  ],
  education: [
    {
      id: "ed1",
      institution: "НИУ ВШЭ",
      specialty: "Прикладная математика",
      degree: "Магистр",
      graduationYear: 2016,
      isCourse: false,
    },
    {
      id: "ed2",
      institution: "Karpov.Courses",
      specialty: "Симулятор A/B-тестов",
      degree: "",
      graduationYear: 2021,
      isCourse: true,
    },
  ],
  skills: {
    hard: ["SQL", "Python", "A/B-тесты", "Airflow", "dbt", "Tableau", "Excel"],
    soft: ["Коммуникация", "Наставничество", "Критическое мышление"],
  },
};
