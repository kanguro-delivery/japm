export default () => ({
    tenancy: {
        enabled: process.env.TENANCY_ENABLED === 'true',
    },
}); 