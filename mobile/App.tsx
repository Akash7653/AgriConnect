import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import RazorpayCheckout from 'react-native-razorpay';
import { apiRequest, getApiError, type Product, type Session } from './src/api';

const SESSION_KEY = 'agriconnect_session';
const green = '#246B45';

interface Address {
  recipientName: string;
  phone: string;
  addressLine1: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
}

interface BuyerOrder {
  _id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  pricing: { finalPayablePaise: number };
  items: Array<{ cropName: string; quantity: number; unit: string }>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<'shop' | 'cart' | 'orders'>('shop');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [registering, setRegistering] = useState(false);
  const [address, setAddress] = useState<Address>({
    recipientName: '',
    phone: '',
    addressLine1: '',
    city: '',
    district: '',
    state: '',
    pinCode: '',
  });

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((value) => {
        if (value) setSession(JSON.parse(value) as Session);
      })
      .catch((storageError: unknown) => setError(getApiError(storageError)))
      .finally(() => setLoading(false));
  }, []);

  async function loadProducts() {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ listings: Product[] }>(`/crops${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setProducts(result.listings || []);
    } catch (loadError) {
      setError(getApiError(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function loadOrders() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ orders: BuyerOrder[] }>('/orders/buyer', {}, session.token);
      setOrders(result.orders || []);
    } catch (loadError) {
      setError(getApiError(loadError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (session) void loadProducts();
  }, [session, query]);

  useEffect(() => {
    if (session && screen === 'orders') void loadOrders();
  }, [session, screen]);

  async function authenticate() {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<Session>(registering ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(registering ? { name, email, password, phone } : { email, password }),
      });
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result));
      setSession(result);
      setAddress((current) => ({ ...current, recipientName: result.user.name, phone }));
    } catch (authError) {
      setError(getApiError(authError));
    } finally {
      setBusy(false);
    }
  }

  async function suggestAddress() {
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission denied. You can enter the delivery address manually.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const reverse = await apiRequest<{ address: { city: string; district: string; state: string; pinCode: string } }>(
        '/location/reverse-geocode',
        {
          method: 'POST',
          body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        }
      );
      setAddress((current) => ({ ...current, ...reverse.address }));
    } catch (locationError) {
      setError(`${getApiError(locationError)} You can enter the delivery address manually.`);
    }
  }

  async function checkout() {
    if (!session) return;
    if (!address.recipientName || !address.phone || !address.addressLine1 || !address.city || !address.district || !address.state || !address.pinCode) {
      setError('Complete all delivery address fields before continuing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{
        orderId: string;
        orderNumber: string;
        razorpayOrderId: string;
        amountPaise: number;
        keyId: string;
      }>('/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({
          items: Object.entries(cart).map(([listingId, quantity]) => ({ listingId, quantity })),
          deliveryAddress: { ...address, addressLine2: '' },
          deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
        }),
      }, session.token);
      const payment = await RazorpayCheckout.open({
        key: result.keyId,
        amount: result.amountPaise,
        currency: 'INR',
        name: 'AgriConnect',
        description: `Order ${result.orderNumber}`,
        order_id: result.razorpayOrderId,
        prefill: { name: address.recipientName, email: session.user.email, contact: address.phone },
        theme: { color: green },
      });
      await apiRequest('/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: result.orderId,
          razorpayOrderId: payment.razorpay_order_id,
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        }),
      }, session.token);
      setCart({});
      setScreen('orders');
      Alert.alert('Payment successful', `Order ${result.orderNumber} is confirmed.`);
    } catch (paymentError) {
      setError(getApiError(paymentError));
    } finally {
      setBusy(false);
    }
  }

  const cartTotal = useMemo(
    () => Object.entries(cart).reduce((sum, [id, quantity]) => {
      const product = products.find((entry) => entry._id === id);
      return sum + (product?.pricePerUnitPaise || 0) * quantity;
    }, 0),
    [cart, products]
  );

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={green} size="large" /></SafeAreaView>;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.auth}>
          <Text style={styles.brand}>AgriConnect</Text>
          <Text style={styles.heading}>{registering ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.muted}>Fresh produce, directly from verified farms.</Text>
          {registering && <TextInput accessibilityLabel="Full name" placeholder="Full name" style={styles.input} value={name} onChangeText={setName} />}
          <TextInput accessibilityLabel="Email" placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} value={email} onChangeText={setEmail} />
          {registering && <TextInput accessibilityLabel="Phone" placeholder="Phone number" keyboardType="phone-pad" style={styles.input} value={phone} onChangeText={setPhone} />}
          <TextInput accessibilityLabel="Password" placeholder="Password" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={() => void authenticate()} disabled={busy}>
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>{registering ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>
          <Pressable onPress={() => setRegistering((value) => !value)} style={styles.linkButton}>
            <Text style={styles.linkText}>{registering ? 'Already registered? Sign in' : 'New to AgriConnect? Create account'}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>AgriConnect</Text>
          <Text style={styles.muted}>Hello, {session.user.name || session.user.email}</Text>
        </View>
        <Pressable
          style={styles.cartButton}
          accessibilityLabel={`Cart, ${Object.values(cart).reduce((sum, count) => sum + count, 0)} items`}
          onPress={() => setScreen(screen === 'cart' ? 'shop' : 'cart')}
        >
          <Text style={styles.cartButtonText}>Cart ({Object.values(cart).reduce((sum, count) => sum + count, 0)})</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['shop', 'cart', 'orders'] as const).map((tab) => (
          <Pressable key={tab} onPress={() => setScreen(tab)} style={[styles.tab, screen === tab && styles.activeTab]}>
            <Text style={[styles.tabText, screen === tab && styles.activeTabText]}>{tab === 'shop' ? 'Shop' : tab === 'cart' ? 'Cart' : 'Orders'}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable onPress={() => screen === 'shop' ? void loadProducts() : setError('')}><Text style={styles.linkText}>Try again / dismiss</Text></Pressable>
        </View>
      ) : null}

      {screen === 'shop' && (
        <>
          <TextInput
            accessibilityLabel="Search produce"
            placeholder="Search fresh produce"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
            returnKeyType="search"
          />
          {busy ? <ActivityIndicator color={green} style={styles.loader} /> : null}
          <FlatList
            data={products}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            refreshing={busy}
            onRefresh={() => void loadProducts()}
            ListEmptyComponent={<Text style={styles.empty}>{error ? 'Products could not be loaded. Pull down to retry.' : 'No produce found. Try another search.'}</Text>}
            renderItem={({ item }) => (
              <View style={styles.product}>
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{item.cropName}</Text>
                  <Text style={styles.muted}>{[item.location?.district, item.location?.state].filter(Boolean).join(', ') || item.farmerId?.name || 'Local farm'}</Text>
                  <Text style={styles.price}>₹{(item.pricePerUnitPaise / 100).toFixed(2)} / {item.unit}</Text>
                  <Text style={styles.muted}>{item.availableQuantity} {item.unit} available</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Add ${item.cropName} to cart`}
                  style={styles.addButton}
                  disabled={item.availableQuantity < 1}
                  onPress={() => setCart((current) => ({
                    ...current,
                    [item._id]: Math.min((current[item._id] || 0) + 1, item.availableQuantity),
                  }))}
                >
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              </View>
            )}
          />
        </>
      )}

      {screen === 'cart' && (
        <ScrollView contentContainerStyle={styles.checkoutContent}>
          <Text style={styles.heading}>Your cart</Text>
          {Object.entries(cart).map(([id, quantity]) => {
            const product = products.find((item) => item._id === id);
            if (!product) return null;
            return (
              <View key={id} style={styles.cartRow}>
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{product.cropName}</Text>
                  <Text style={styles.muted}>{quantity} × ₹{(product.pricePerUnitPaise / 100).toFixed(2)} / {product.unit}</Text>
                </View>
                <Pressable onPress={() => setCart((current) => {
                  const next = { ...current };
                  if (quantity <= 1) delete next[id];
                  else next[id] = quantity - 1;
                  return next;
                })}><Text style={styles.linkText}>Remove</Text></Pressable>
              </View>
            );
          })}
          {Object.keys(cart).length === 0 ? <Text style={styles.empty}>Your cart is empty. Browse the shop to add produce.</Text> : null}
          <Text style={styles.price}>Subtotal: ₹{(cartTotal / 100).toFixed(2)}</Text>
          <Text style={styles.muted}>Delivery and final pricing are confirmed securely by the server.</Text>
          <Text style={styles.heading}>Delivery address</Text>
          <Pressable style={styles.secondaryButton} onPress={() => void suggestAddress()}>
            <Text style={styles.secondaryText}>Suggest address from my location</Text>
          </Pressable>
          <Text style={styles.muted}>Location is optional. You can enter your address manually.</Text>
          {([
            ['recipientName', 'Recipient name'],
            ['phone', 'Phone'],
            ['addressLine1', 'Street address'],
            ['city', 'City'],
            ['district', 'District'],
            ['state', 'State'],
            ['pinCode', 'PIN code'],
          ] as const).map(([key, placeholder]) => (
            <TextInput
              key={key}
              accessibilityLabel={placeholder}
              placeholder={placeholder}
              value={address[key]}
              onChangeText={(value) => setAddress((current) => ({ ...current, [key]: value }))}
              style={styles.input}
            />
          ))}
          <Pressable
            style={[styles.primaryButton, (busy || Object.keys(cart).length === 0) && styles.disabled]}
            onPress={() => void checkout()}
            disabled={busy || Object.keys(cart).length === 0}
          >
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Continue to secure payment</Text>}
          </Pressable>
        </ScrollView>
      )}

      {screen === 'orders' && (
        <FlatList
          data={orders}
          keyExtractor={(order) => order._id}
          contentContainerStyle={styles.list}
          refreshing={busy}
          onRefresh={() => void loadOrders()}
          ListHeaderComponent={<Text style={styles.heading}>Your orders</Text>}
          ListEmptyComponent={<Text style={styles.empty}>{error ? 'Orders could not be loaded. Pull down to retry.' : 'No orders yet. Your order history will appear here.'}</Text>}
          renderItem={({ item }) => (
            <View style={styles.product}>
              <View style={styles.productCopy}>
                <Text style={styles.productName}>Order {item.orderNumber}</Text>
                <Text style={styles.muted}>{item.items.map((entry) => `${entry.cropName} × ${entry.quantity} ${entry.unit}`).join(', ')}</Text>
                <Text style={styles.muted}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View>
                <Text style={styles.price}>₹{(item.pricing.finalPayablePaise / 100).toFixed(2)}</Text>
                <Text style={styles.muted}>{item.status.replaceAll('_', ' ')}</Text>
              </View>
            </View>
          )}
        />
      )}

      <Pressable style={styles.signOut} onPress={() => {
        Alert.alert('Sign out', 'Sign out of AgriConnect?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => {
            void AsyncStorage.removeItem(SESSION_KEY);
            setSession(null);
            setCart({});
          } },
        ]);
      }}>
        <Text style={styles.linkText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5ED' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#F7F5ED' },
  auth: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#163D2B', fontWeight: '800', fontSize: 24 },
  heading: { color: '#163D2B', fontWeight: '700', fontSize: 23, marginTop: 12 },
  muted: { color: '#66716A', fontSize: 14, lineHeight: 21 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#D8E0D9', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: '#18231C' },
  search: { margin: 16, minHeight: 48, borderWidth: 1, borderColor: '#D8E0D9', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 50, padding: 14, borderRadius: 12, backgroundColor: green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { minHeight: 46, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: green, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: green, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  linkButton: { padding: 10, alignItems: 'center' },
  linkText: { color: green, fontWeight: '600' },
  cartButton: { borderRadius: 20, backgroundColor: green, paddingHorizontal: 16, paddingVertical: 10 },
  cartButtonText: { color: 'white', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#D8E0D9' },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: green },
  tabText: { color: '#66716A', fontWeight: '600' },
  activeTabText: { color: green },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  product: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#E6EAE6' },
  productCopy: { flex: 1, gap: 4 },
  productName: { color: '#163D2B', fontWeight: '700', fontSize: 17 },
  price: { color: '#246B45', fontWeight: '700', fontSize: 16, marginTop: 4 },
  addButton: { backgroundColor: '#EAF3EC', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  addText: { color: green, fontWeight: '700' },
  loader: { margin: 8 },
  empty: { color: '#66716A', padding: 20, textAlign: 'center', lineHeight: 22 },
  checkoutContent: { padding: 18, gap: 12, paddingBottom: 48 },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E6EAE6' },
  signOut: { padding: 14, alignItems: 'center' },
  error: { color: '#A72828', lineHeight: 20 },
  errorBox: { marginHorizontal: 16, marginTop: 12, padding: 12, backgroundColor: '#FFF0EF', borderRadius: 10, gap: 8 },
  disabled: { opacity: 0.5 },
});
