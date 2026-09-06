import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/localStorage.ts', 'store/gtss-store.ts', 'src/gtssValidation.ts', 'src/queryClient.ts', 'src/utils.ts'],
        },
    },
});