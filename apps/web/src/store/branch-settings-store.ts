// Branch Settings Store - Persisted with localStorage
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BranchSettings {
    name: string;
    address: string;
    phone: string;
    gstNumber: string;
    gstEnabled: boolean;
    fssaiNumber: string;
}

interface BranchSettingsState {
    settings: BranchSettings;
    updateSettings: (updates: Partial<BranchSettings>) => void;
    resetSettings: () => void;
}

const defaultSettings: BranchSettings = {
    name: '',
    address: '',
    phone: '',
    gstNumber: '',
    gstEnabled: false,
    fssaiNumber: '',
};

export const useBranchSettingsStore = create<BranchSettingsState>()(
    persist(
        (set) => ({
            settings: defaultSettings,

            updateSettings: (updates) => {
                set((state) => ({
                    settings: { ...state.settings, ...updates },
                }));
            },

            resetSettings: () => {
                set({ settings: defaultSettings });
            },
        }),
        {
            name: 'billova-branch-settings', // localStorage key
        }
    )
);

export default useBranchSettingsStore;
