import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.log('❌ ErrorBoundary:', error?.message);
    console.log('❌ Stack:', error?.stack);
    console.log('❌ Component:', info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = String(err?.message || err || '');
      const stack = String(err?.stack || '').slice(0, 1500);
      return (
        <View style={{ flex: 1, backgroundColor: '#0a1628', padding: 20, justifyContent: 'center' }}>
          <ScrollView>
            <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginBottom: 12 }}>
              ⚠️ خطا در اجرا
            </Text>
            <Text style={{ color: '#fff', textAlign: 'right', marginBottom: 12, fontSize: 14 }}>
              {msg}
            </Text>
            <Text style={{ color: '#94a3b8', textAlign: 'right', fontSize: 9 }}>
              {stack}
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{ backgroundColor: '#7c3aed', padding: 12, borderRadius: 8, marginTop: 16 }}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🔄 تلاش مجدد</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
