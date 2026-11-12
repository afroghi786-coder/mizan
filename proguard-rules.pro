# حفظ کتابخانه JNA (که باعث ارجاع به java.awt می‌شود)
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }

# نادیده گرفتن کلاس‌های java.awt که در اندروید وجود ندارند
-dontwarn java.awt.Component
-dontwarn java.awt.GraphicsEnvironment
-dontwarn java.awt.HeadlessException
-dontwarn java.awt.Window