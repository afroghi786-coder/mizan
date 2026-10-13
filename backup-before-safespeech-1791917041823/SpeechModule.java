package com.mezan786.mizan.speech;

import android.content.Intent;
import android.os.Bundle;
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
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import java.util.Locale;

public class SpeechModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private final ReactApplicationContext reactContext;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean isListening = false;

    public SpeechModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        context.addLifecycleEventListener(this);
        // Init TTS
        tts = new TextToSpeech(context, status -> {
            if (status == TextToSpeech.SUCCESS) {
                try {
                    int faResult = tts.setLanguage(new Locale("fa", "IR"));
                    if (faResult == TextToSpeech.LANG_MISSING_DATA || faResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.US);
                    }
                    ttsReady = true;
                } catch (Exception e) {
                    ttsReady = false;
                }
            }
        });
    }

    @Override
    public String getName() {
        return "Speech";
    }

    private void sendEvent(String name, WritableMap params) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(name, params);
        } catch (Exception ignored) {}
    }

    @ReactMethod
    public void startListening(String lang, Promise promise) {
        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            promise.reject("NOT_AVAILABLE", "Speech recognition not available");
            return;
        }
        if (isListening) {
            promise.resolve(true);
            return;
        }
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
            final Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            String useLang = (lang != null && !lang.isEmpty()) ? lang : "fa-IR";
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
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    WritableArray arr = Arguments.createArray();
                    if (matches != null) {
                        for (String s : matches) arr.pushString(s);
                    }
                    WritableMap m = Arguments.createMap();
                    m.putArray("results", arr);
                    if (matches != null && !matches.isEmpty()) m.putString("text", matches.get(0));
                    else m.putString("text", "");
                    sendEvent("onSpeechResult", m);
                }
                @Override public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        WritableMap m = Arguments.createMap();
                        m.putString("text", matches.get(0));
                        sendEvent("onSpeechPartial", m);
                    }
                }
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            speechRecognizer.startListening(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("START_ERROR", e.getMessage());
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
            promise.reject("STOP_ERROR", e.getMessage());
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
            promise.reject("CANCEL_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void speak(String text, String lang, Promise promise) {
        try {
            if (!ttsReady) {
                promise.reject("TTS_NOT_READY", "TTS not ready");
                return;
            }
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mizan_" + System.currentTimeMillis());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TTS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopSpeaking(Promise promise) {
        try {
            if (tts != null) tts.stop();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_TTS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            boolean avail = SpeechRecognizer.isRecognitionAvailable(reactContext);
            promise.resolve(avail);
        } catch (Exception e) {
            promise.resolve(false);
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
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "مجوز صدا ندارید";
            case SpeechRecognizer.ERROR_NETWORK: return "خطای شبکه";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "شبکه timeout شد";
            case SpeechRecognizer.ERROR_NO_MATCH: return "چیزی نفهمیدم";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "موتور مشغول است";
            case SpeechRecognizer.ERROR_SERVER: return "خطای سرور";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "چیزی نگفتی";
            default: return "خطای ناشناخته: " + error;
        }
    }

    @Override public void onHostResume() {}
    @Override public void onHostPause() {
        if (speechRecognizer != null) {
            try { speechRecognizer.stopListening(); } catch (Exception ignored) {}
        }
    }
    @Override public void onHostDestroy() {
        if (speechRecognizer != null) {
            try { speechRecognizer.destroy(); } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
        }
    }
}
