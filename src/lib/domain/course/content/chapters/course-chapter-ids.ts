/**
 * Lightweight course topology used by progress migrations.
 *
 * Keep these IDs separate from the authored chapter blueprints so validating a
 * saved snapshot does not pull the full vocabulary and dialogue catalog into
 * the initial client bundle.
 */
export const expandedCourseChapterIdsBySource: Readonly<Record<string, readonly string[]>> = {
  'chapter-01-school': ['chapter-31-first-introduction'],
  'chapter-11-classroom': ['chapter-32-find-the-right-page', 'chapter-33-ask-for-repetition'],
  'chapter-12-cafe-bakery': [
    'chapter-34-simple-order',
    'chapter-35-price-and-payment',
    'chapter-36-takeaway-order',
    'chapter-37-repair-the-order',
  ],
  'chapter-02-day': ['chapter-38-morning-time'],
  'chapter-13-home-family': [
    'chapter-39-who-lives-here',
    'chapter-40-whose-is-it',
    'chapter-41-evening-together',
  ],
  'chapter-14-city': [
    'chapter-42-route-to-destination',
    'chapter-43-right-stop',
    'chapter-44-transfer-in-town',
  ],
  'chapter-03-travel': ['chapter-45-ticket-and-departure'],
  'chapter-15-hotel': ['chapter-46-confirm-reservation', 'chapter-47-room-problem'],
  'chapter-16-health': [
    'chapter-48-describe-symptoms',
    'chapter-49-at-the-pharmacy',
    'chapter-50-safe-dosage',
    'chapter-51-when-to-see-doctor',
  ],
  'chapter-04-plans': ['chapter-52-suggest-a-time'],
  'chapter-17-shopping-returns': [
    'chapter-53-compare-two-options',
    'chapter-54-describe-a-defect',
    'chapter-55-request-a-remedy',
  ],
  'chapter-18-housing-neighbors': [
    'chapter-56-flat-viewing',
    'chapter-57-neighbour-agreement',
    'chapter-58-house-rules',
  ],
  'chapter-19-study-goals': [
    'chapter-59-measurable-study-goal',
    'chapter-60-weekly-study-plan',
    'chapter-61-learning-obstacle',
    'chapter-62-review-progress',
  ],
  'chapter-20-work-experience': ['chapter-63-practical-example', 'chapter-64-report-an-absence'],
  'chapter-05-home-work': ['chapter-65-home-service-case'],
  'chapter-21-narrative-news': [
    'chapter-66-order-events',
    'chapter-67-earlier-event',
    'chapter-68-brief-report',
  ],
  'chapter-06-process': ['chapter-69-explain-a-process'],
  'chapter-22-opinion-compromise': [
    'chapter-70-opinion-with-reason',
    'chapter-71-acknowledge-objection',
    'chapter-72-propose-compromise',
  ],
  'chapter-07-project': ['chapter-73-compare-project-options'],
  'chapter-23-feedback-conflict': ['chapter-74-specific-feedback', 'chapter-75-calm-the-conflict'],
  'chapter-24-remote-work': [
    'chapter-76-remote-work-pilot',
    'chapter-77-measurable-criteria',
    'chapter-78-experiment-conditions',
    'chapter-79-evidence-based-decision',
  ],
  'chapter-08-negotiation': ['chapter-80-set-conditions'],
  'chapter-25-complaint-remedy': [
    'chapter-81-core-of-complaint',
    'chapter-82-proportionate-responsibility',
    'chapter-83-remedy-with-deadline',
  ],
  'chapter-26-data-consequences': [
    'chapter-84-describe-a-trend',
    'chapter-85-correlation-not-cause',
    'chapter-86-limited-recommendation',
  ],
  'chapter-27-expert-discussion': [
    'chapter-87-strength-of-evidence',
    'chapter-88-transparent-limitation',
  ],
  'chapter-28-media-indirect-speech': [
    'chapter-89-report-a-claim',
    'chapter-90-source-and-comment',
    'chapter-91-calibrate-uncertainty',
    'chapter-92-compare-media-claims',
  ],
  'chapter-09-argument': ['chapter-93-answer-counterargument'],
  'chapter-10-style': ['chapter-94-cut-clumsy-text'],
  'chapter-29-mediation': [
    'chapter-95-neutral-summary',
    'chapter-96-false-agreement',
    'chapter-97-procedural-next-step',
  ],
  'chapter-30-policy-brief': [
    'chapter-98-synthesise-inputs',
    'chapter-99-state-the-limits',
    'chapter-100-decision-recommendation',
  ],
};

export const diversityChapterIdsByPreviousChapter: Readonly<Record<string, readonly string[]>> = {
  'chapter-37-repair-the-order': ['chapter-101-market-groceries', 'chapter-102-hobby-meetup'],
  'chapter-44-transfer-in-town': [
    'chapter-103-weather-and-clothing',
    'chapter-104-library-services',
  ],
  'chapter-51-when-to-see-doctor': ['chapter-105-dietary-needs', 'chapter-106-civic-services'],
  'chapter-58-house-rules': ['chapter-107-travel-disruptions', 'chapter-108-cultural-evening'],
  'chapter-65-home-service-case': [
    'chapter-109-community-volunteering',
    'chapter-110-workplace-onboarding',
  ],
  'chapter-72-propose-compromise': [
    'chapter-111-academic-presentation',
    'chapter-112-media-literacy',
  ],
  'chapter-79-evidence-based-decision': [
    'chapter-113-energy-efficiency',
    'chapter-114-project-risk',
  ],
  'chapter-86-limited-recommendation': [
    'chapter-115-digital-privacy',
    'chapter-116-accessible-city',
  ],
  'chapter-93-answer-counterargument': [
    'chapter-117-research-ethics',
    'chapter-118-science-communication',
  ],
  'chapter-100-decision-recommendation': [
    'chapter-119-public-policy',
    'chapter-120-crisis-communication',
  ],
};
