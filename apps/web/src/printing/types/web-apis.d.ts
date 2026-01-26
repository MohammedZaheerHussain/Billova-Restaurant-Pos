/// <reference types="w3c-web-usb" />
/// <reference types="web-bluetooth" />

// Web API Type Declarations for Browser APIs
// These are needed for WebUSB and Web Bluetooth support

declare global {
    interface Navigator {
        usb?: USB;
        bluetooth?: Bluetooth;
    }
}

// Export empty to make this a module
export { };
