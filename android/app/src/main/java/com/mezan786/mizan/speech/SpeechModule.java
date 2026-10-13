package com.mezan786.mizan.speech;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import java.util.Locale;

public class SpeechModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private final ReactApplicationContext reactContext;
    private SpeechRecognizer speechRecognizer = null;
    private TextToSpeech tts = null;
    private boolean ttsReady = false;
    private boolean ttsInitFailed = false;
    private boolean isListening = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public SpeechModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        try {
            context.addLifecycleEventListener(this);
        } catch (Exception ignored) {}
        // TTS رو lazy می‌کنیم — نه در constructor
    }

    @Override
    public String getName() {
        return "Speech";
    }

    // ─── Lazy init برای TTS
    private void initTTSIfNeeded() {
        if (tts != null || ttsInitFailed) return;
        try {
            tts = new TextToSpeech(reactContext.getApplicationContext(), status -> {
                try {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        int faResult = tts.setLanguage(new Locale("fa", "IR"));
                        if (faResult == TextToSpeech.LANG_MISSING_DATA || faResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                            // فارسی نیست، انگلیسی
                            try {
                                tts.setLanguage(Locale.US);
                            } catch (Exception ignored) {}
                        }
                        ttsReady = true;
                    } else {
                        ttsInitFailed = true;
                    }
                } catch (Exception e) {
                    ttsInitFailed = true;
                }
            });
        } catch (Exception e) {
            ttsInitFailed = true;
            tts = null;
        }
    }

    // ─── Event emitter ایمن
    private void sendEvent(String name, WritableMap params) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(name, params);
        } catch (Exception ignored) {}
    }

    // ═══════════════════════════════════════════
    // STT — Speech to Text
    // ═══════════════════════════════════════════
    @ReactMethod
    public void startListening(String lang, Promise promise) {
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
                promise.reject("NOT_AVAILABLE", "تشخیص گفتار روی این گوشی نیست");
                return;
            }

            if (isListening && speechRecognizer != null) {
                promise.resolve(true);
                return;
            }

            // پاکسازی قبلی
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.destroy();
                    speechRecognizer = null;
                }
            } catch (Exception ignored) {}

            // ساخت جدید — در main thread
            final String useLang = (lang != null && !lang.isEmpty()) ? lang : "fa-IR";
            mainHandler.post(() -> {
                try {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
                    if (speechRecognizer == null) {
                        WritableMap m = Arguments.createMap();
                        m.putString("message", "سرویس تشخیص گفتار در دسترس نیست");
                        sendEvent("onSpeechError", m);
                        return;
                    }

                    final Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, useLang);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, useLang);
                    intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                    intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.getPackageName());

                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override public void onReadyForSpeech(Bundle params) {
                            isListening = true;
                            WritableMap m = Arguments.createMap();
                            m.putString("status", "ready");
                            sendEvent("onSpeechReady", m);
                        }
                        @Override public void onBeginningOfSpeech() {
                            WritableMap m = Arguments.createMap();
                            m.putString("status", "speaking");
                            sendEvent("onSpeechStart", m);
                        }
                        @Override public void onRmsChanged(float rmsdB) {}
                        @Override public void onBufferReceived(byte[] buffer) {}
                        @Override public void onEndOfSpeech() {
                            WritableMap m = Arguments.createMap();
                            m.putString("status", "processing");
                            sendEvent("onSpeechEnd", m);
                        }
                        @Override public void onError(int error) {
                            isListening = false;
                            WritableMap m = Arguments.createMap();
                            m.putInt("error", error);
                            m.putString("message", errorToString(error));
                            sendEvent("onSpeechError", m);
                        }
                        @Override public void onResults(Bundle results) {
                            isListening = false;
                            try {
                                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                                WritableMap m = Arguments.createMap();
                                if (matches != null && !matches.isEmpty()) {
                                    m.putString("text", matches.get(0));
                                } else {
                                    m.putString("text", "");
                                }
                                sendEvent("onSpeechResult", m);
                            } catch (Exception e) {
                                WritableMap m = Arguments.createMap();
                                m.putString("text", "");
                                sendEvent("onSpeechResult", m);
                            }
                        }
                        @Override public void onPartialResults(Bundle partialResults) {
                            try {
                                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                                if (matches != null && !matches.isEmpty()) {
                                    WritableMap m = Arguments.createMap();
                                    m.putString("text", matches.get(0));
                                    sendEvent("onSpeechPartial", m);
                                }
                            } catch (Exception ignored) {}
                        }
                        @Override public void onEvent(int eventType, Bundle params) {}
                    });
                    speechRecognizer.startListening(intent);
                } catch (Exception e) {
                    WritableMap m = Arguments.createMap();
                    m.putString("message", "خطا: " + (e.getMessage() != null ? e.getMessage() : "ناشناخته"));
                    sendEvent("onSpeechError", m);
                }
            });

            promise.resolve(true);
        } catch (Exception e) {
            try { promise.reject("START_ERROR", e.getMessage()); } catch (Exception ignored) {}
        }
    }

    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
            isListening = false;
            promise.resolve(true);
        } catch (Exception e) {
            try { promise.resolve(true); } catch (Exception ignored) {}
        }
    }

    @ReactMethod
    public void cancel(Promise promise) {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.cancel();
            }
            isListening = false;
            promise.resolve(true);
        } catch (Exception e) {
            try { promise.resolve(true); } catch (Exception ignored) {}
        }
    }

    // ═══════════════════════════════════════════
    // TTS — Text to Speech
    // ═══════════════════════════════════════════
    @ReactMethod
    public void speak(String text, String lang, Promise promise) {
        try {
            if (text == null || text.isEmpty()) {
                promise.resolve(false);
                return;
            }
            initTTSIfNeeded();
            if (tts == null || ttsInitFailed) {
                promise.resolve(false);
                return;
            }
            if (!ttsReady) {
                // یه بار صبر کن
                mainHandler.postDelayed(() -> {
                    try {
                        if (tts != null && ttsReady) {
                            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mizan_" + System.currentTimeMillis());
                        }
                    } catch (Exception ignored) {}
                }, 500);
                promise.resolve(true);
                return;
            }
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mizan_" + System.currentTimeMillis());
            promise.resolve(true);
        } catch (Exception e) {
            try { promise.resolve(false); } catch (Exception ignored) {}
        }
    }

    @ReactMethod
    public void stopSpeaking(Promise promise) {
        try {
            if (tts != null) tts.stop();
            promise.resolve(true);
        } catch (Exception e) {
            try { promise.resolve(true); } catch (Exception ignored) {}
        }
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext));
        } catch (Exception e) {
            try { promise.resolve(false); } catch (Exception ignored) {}
        }
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private String errorToString(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "خطای صدا";
            case SpeechRecognizer.ERROR_CLIENT: return "خطای کلاینت";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "مجوز میکروفون نیست";
            case SpeechRecognizer.ERROR_NETWORK: return "نیاز به اینترنت";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "شبکه کند";
            case SpeechRecognizer.ERROR_NO_MATCH: return "نفهمیدم، دوباره بگو";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "در حال کار...";
            case SpeechRecognizer.ERROR_SERVER: return "خطای سرور";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "چیزی نگفتی";
            default: return "خطای " + error;
        }
    }

    @Override public void onHostResume() {}
    @Override public void onHostPause() {
        try {
            if (speechRecognizer != null) speechRecognizer.stopListening();
        } catch (Exception ignored) {}
    }
    @Override public void onHostDestroy() {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
                speechRecognizer = null;
            }
        } catch (Exception ignored) {}
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
                tts = null;
            }
        } catch (Exception ignored) {}
    }
}
