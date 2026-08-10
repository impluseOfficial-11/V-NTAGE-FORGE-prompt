const state = {
    unlocked: false,
    apiKey: null,
    rememberKey: false,
    basePrompt: '',
    outputMode: 'balanced',
    engineStyle: 'principal_engineer',
    attachedFiles: [],
    analysis: null,
    phases: [],
    currentPhase: 0,
    selections: {},
    customRequirements: [],
    finalPrompt: '',
    generationVersions: [],
    currentVersion: -1,
    qualityData: null,
    history: [],
    currentPanel: 'dashboard',
    settings: {
        bgVideo: true,
        particles: true,
        reducedMotion: false,
    },
};

export default state;