import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  User as UserIcon,
  X,
  Star,
  Filter,
  Truck,
  ChevronRight,
  Heart,
  ArrowRight,
  CheckCircle,
  Trash2,
  ShieldCheck,
  Lock,
  CreditCard,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Product, Review, Order, UserProfile, PaymentReceiptInfo } from './types';
import { MOCK_PRODUCTS } from './data/mockProducts';
import { PaymentGateway } from './components/PaymentGateway';

// --- Contexts ---

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

interface WishlistContextType {
  items: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);
const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, name: string, phone: string) => Promise<void>;
  updateUserProfile: (updated: UserProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const Navbar = ({ onOpenCart }: { onOpenCart: () => void }) => {
  const { user, loginWithGoogle } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Track Order', path: '/tracking' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-stone-100 py-4 shadow-sm">
      <div className="container mx-auto px-6 flex items-center justify-between relative">
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-white shadow-md transition-transform group-hover:scale-105">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-31_at_8.01.10_PM_7cb39e09.jpeg"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('/public/')) {
                  target.src = '/public/assets/aistudio/WhatsApp_Image_2026-10-31_at_8.01.10_PM_7cb39e09.jpeg';
                }
              }}
              alt="Nivora Prime Logo"
              className="w-full h-full object-cover scale-150"
            />
          </div>
          <span className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap">
            NIVORA <span className="font-light text-[#D4AF37]">PRIME</span>
          </span>
        </Link>

        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8 text-[11px] font-medium text-stone-600 uppercase tracking-[0.2em]">
          {navLinks.map(link => (
            <Link key={link.path} to={link.path} className="hover:text-stone-900 transition-colors whitespace-nowrap">{link.name}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => navigate('/shop?search=1')}
            className="text-stone-600 hover:text-stone-900 transition-colors cursor-pointer p-1"
            aria-label="Search Catalog"
          >
            <Search size={16} strokeWidth={1.5} />
          </button>

          <Link to="/wishlist" className="text-stone-600 hover:text-stone-900 transition-colors relative p-1" aria-label="Wishlist">
            <Heart size={16} strokeWidth={1.5} />
          </Link>

          <Link to="/profile" className="text-stone-600 hover:text-stone-900 transition-colors relative p-1" aria-label="Profile">
            <UserIcon size={16} strokeWidth={1.5} />
          </Link>

          <button onClick={onOpenCart} className="text-stone-600 hover:text-stone-900 transition-colors relative cursor-pointer p-1" aria-label="Open Cart">
            <ShoppingBag size={16} strokeWidth={1.5} />
            {items.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-stone-900 text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white shadow-sm">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

const CartDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { items, updateQuantity, removeFromCart, total } = useCart();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-stone-100">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Shopping Bag</h2>
                <p className="text-xs text-stone-400 mt-0.5">256-bit SSL Encrypted Checkout</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors cursor-pointer" aria-label="Close bag">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-500 gap-4">
                  <ShoppingBag size={32} strokeWidth={1} />
                  <p>Your bag is empty</p>
                  <button onClick={() => { onClose(); navigate('/shop'); }} className="text-sm underline cursor-pointer">Continue Shopping</button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-20 bg-stone-100 rounded-lg overflow-hidden shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between gap-2">
                        <h3 className="font-medium text-stone-900 text-sm">{item.name}</h3>
                        <p className="text-stone-900 font-semibold tabular-nums text-sm">₹{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{item.category}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="inline-flex items-center border border-stone-200 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2.5 text-xs font-semibold tabular-nums text-stone-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-600 hover:underline cursor-pointer">Remove</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-stone-100 space-y-4 bg-stone-50/50">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">₹{total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { onClose(); navigate('/checkout'); }}
                  className="w-full py-4 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock size={14} className="text-[#D4AF37]" />
                  <span>Secure Checkout</span>
                  <ArrowRight size={14} />
                </button>
                <p className="text-[11px] text-center text-stone-400">
                  Cards · Net Banking · Wallets · UPI Supported
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- Pages ---

const Home = () => {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative h-[88vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/nivora_hero_banner_1793461505030.jpg"
            alt="Nivora Prime Botanical Luxury"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-transparent" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl text-white"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D4AF37] mb-5">
              New Collection 2026
            </p>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.08]">
              Timeless Beauty, <br /> Defined by You.
            </h1>
            <p className="text-lg mb-10 text-stone-100 max-w-lg leading-relaxed">
              Discover Nivora Prime's exclusive range of botanical skincare, luxury cosmetics, and handcrafted heritage jewelry.
            </p>
            <div className="flex flex-row gap-4">
              <Link to="/shop" className="px-8 py-4 bg-white text-stone-900 font-bold rounded-xl hover:bg-stone-100 transition-all shadow-xl whitespace-nowrap">
                Shop Collection
              </Link>
              <Link to="/tracking" className="px-8 py-4 border border-white/50 text-white font-bold rounded-xl hover:bg-white/10 transition-all backdrop-blur-sm whitespace-nowrap">
                Track Your Order
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-bold mb-4 text-stone-900">Our Essentials</h2>
              <p className="text-stone-500 max-w-md">Curated selection of our best-selling botanical formulas, cosmetics, and artisanal jewelry.</p>
            </div>
            <Link to="/shop" className="text-stone-900 font-semibold flex items-center gap-2 group border-b border-stone-900 pb-1">
              View All Products <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10">
            {MOCK_PRODUCTS.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const active = isInWishlist(product.id);
  const navigate = useNavigate();

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="block relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100 mb-4">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={active ? 'Remove from Wishlist' : 'Save to Wishlist'}
            className={`p-2 rounded-full shadow-sm transition-colors cursor-pointer ${active ? 'bg-stone-900 text-white' : 'bg-white/90 text-stone-900 hover:text-[#D4AF37]'}`}
          >
            <Heart size={14} fill={active ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9A7B1C]">{product.category}</p>
        <h3 className="text-base font-bold text-stone-900 hover:text-stone-600 transition-colors line-clamp-1">{product.name}</h3>
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold tabular-nums text-stone-900">₹{product.price}</span>
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 bg-stone-900 text-white text-[10px] font-bold rounded-lg hover:bg-stone-800 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            Add to Bag
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Shop = () => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const showSearchFocus = new URLSearchParams(location.search).get('search') === '1';

  const filteredProducts = MOCK_PRODUCTS.filter((p) => {
    const matchesCategory = filter === 'All' || p.category === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="pt-32 pb-24 min-h-screen bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl font-bold text-stone-900">The Catalog</h1>
          <p className="text-stone-500">Refined beauty and artisanal jewelry for every story.</p>

          <div className="max-w-md mx-auto pt-2 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              autoFocus={showSearchFocus}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skincare, cosmetics, jewelry..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ProductDetails = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user, loginWithGoogle } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const p = MOCK_PRODUCTS.find(item => item.id === id);
    if (p) setProduct(p);

    if (id) {
      const q = query(collection(db, 'reviews'), where('productId', '==', id), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
        },
        (err) => {
          console.error('Review listener error:', err);
        }
      );
      return unsubscribe;
    }
  }, [id]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setIsSubmitting(true);

    const reviewId = 'rev_' + Math.random().toString(36).substring(2, 10);
    try {
      await setDoc(doc(db, 'reviews', reviewId), {
        id: reviewId,
        productId: id,
        userId: user.uid,
        userName: (user.displayName || 'Nivora Member').slice(0, 100),
        rating: newReview.rating,
        comment: newReview.comment.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      });
      setNewReview({ rating: 5, comment: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) return <div className="pt-40 text-center">Product not found</div>;

  const inWishlist = isInWishlist(product.id);

  return (
    <div className="pt-32 pb-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Gallery */}
          <div className="lg:sticky lg:top-32 h-fit">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-stone-100">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Info */}
          <div className="space-y-10">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-[#9A7B1C] font-bold">{product.category}</p>
              <h1 className="text-5xl font-bold text-stone-900">{product.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={i < Math.floor(product.rating) ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <span className="text-sm text-stone-500">({product.reviewsCount + reviews.length} Customer Reviews)</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-stone-900">₹{product.price}</p>
            </div>

            <p className="text-lg text-stone-600 leading-relaxed">{product.description}</p>

            <div className="space-y-6 pt-8 border-t border-stone-100">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    addToCart(product);
                    navigate('/checkout');
                  }}
                  className="flex-1 py-5 bg-stone-900 text-white font-bold rounded-2xl hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <ShoppingBag size={16} /> Buy
                </button>
                <button
                  onClick={() => toggleWishlist(product.id)}
                  aria-label="Toggle Wishlist"
                  className={`p-5 border rounded-2xl transition-colors cursor-pointer ${inWishlist ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:bg-stone-50 text-stone-900'}`}
                >
                  <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-stone-50 rounded-xl flex items-center gap-3">
                  <Truck size={16} className="text-[#D4AF37]" /> <span>Free Express Delivery</span>
                </div>
                <div className="p-4 bg-stone-50 rounded-xl flex items-center gap-3">
                  <ShieldCheck size={16} className="text-[#D4AF37]" /> <span>PCI DSS Encrypted Checkout</span>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="pt-12 border-t border-stone-100">
              <h2 className="text-2xl font-bold mb-8 text-stone-900">Customer Experience</h2>

              {user ? (
                <form onSubmit={handleAddReview} className="bg-stone-50 p-6 rounded-2xl mb-12 space-y-4">
                  <h3 className="font-semibold text-stone-900">Share your ritual</h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewReview(prev => ({ ...prev, rating: r }))}
                        className={`p-1 cursor-pointer ${newReview.rating >= r ? 'text-amber-400' : 'text-stone-300'}`}
                      >
                        <Star size={20} fill="currentColor" />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Describe your experience..."
                    className="w-full bg-white rounded-xl p-4 border border-stone-200 focus:border-[#D4AF37] h-24 outline-none"
                    required
                  />
                  <button
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Posting...' : 'Post Review'}
                  </button>
                </form>
              ) : (
                <div className="bg-stone-50 p-6 rounded-2xl mb-12 text-center border border-dashed border-stone-200">
                  <p className="text-stone-500 text-sm mb-4">Sign in with Gmail to leave a verified review</p>
                  <button onClick={loginWithGoogle} className="text-sm font-bold underline text-[#9A7B1C] cursor-pointer">Sign in to Review</button>
                </div>
              )}

              <div className="space-y-8">
                {reviews.length === 0 ? (
                  <p className="text-stone-500 italic text-sm">No reviews yet. Be the first to share your thoughts.</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="space-y-2 pb-6 border-b border-stone-100 last:border-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">{review.userName}</span>
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={10} fill={i < review.rating ? 'currentColor' : 'none'} />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-stone-600 text-sm leading-relaxed">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Wishlist = () => {
  const { items: wishlistIds, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const wishlistProducts = MOCK_PRODUCTS.filter(p => wishlistIds.includes(p.id));

  return (
    <div className="pt-32 pb-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 text-stone-900">Your Ritual Wishlist</h1>
          <p className="text-stone-500">Saved locally and synced across your Nivora Prime account.</p>
        </div>

        {wishlistProducts.length === 0 ? (
          <div className="max-w-md mx-auto bg-white p-12 rounded-3xl shadow-sm text-center space-y-6 border border-stone-100">
            <Heart size={32} className="mx-auto text-stone-300" strokeWidth={1} />
            <p className="text-stone-500">Your wishlist is currently empty.</p>
            <Link to="/shop" className="inline-block px-8 py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-colors">
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {wishlistProducts.map(product => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row border border-stone-100"
              >
                <div className="w-full md:w-40 aspect-square shrink-0">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] uppercase tracking-widest text-[#9A7B1C] font-bold">{product.category}</p>
                      <button onClick={() => toggleWishlist(product.id)} className="text-stone-400 hover:text-red-500 transition-colors cursor-pointer" aria-label="Remove item">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-stone-900">{product.name}</h3>
                    <p className="font-bold tabular-nums text-stone-900">₹{product.price}</p>
                  </div>
                  <button
                    onClick={() => {
                      addToCart(product);
                      navigate('/checkout');
                    }}
                    className="mt-4 w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors shadow-sm cursor-pointer"
                  >
                    Buy Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface CompletedOrderSummary {
  orderId: string;
  paidAmountInr: number;
  receipt: PaymentReceiptInfo;
}

const Checkout = () => {
  const { items, total, clearCart, updateQuantity } = useCart();
  const { user, profile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', address: '', phone: '' });
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderSummary | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        name: prev.name || profile?.name || user.displayName || '',
        email: prev.email || user.email || '',
        phone: prev.phone || profile?.phone || '',
      }));
    }
  }, [user, profile]);

  // Handle Cashfree Redirect Return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const orderId = params.get('order_id');
    const sig = params.get('sig');
    const gateway = params.get('gateway');
    const amount = params.get('amount');
    const error = params.get('error');

    if (error) {
      setFirestoreError(decodeURIComponent(error));
      // Remove query params to prevent re-processing
      window.history.replaceState({}, '', window.location.pathname);
    } else if (success === 'true' && orderId && sig && gateway) {
      const receipt: PaymentReceiptInfo = {
        gateway,
        method: 'upi', // Cashfree redirect usually for UPI/generic
        transactionId: 'cf_' + orderId,
        maskedInstrument: 'Cashfree Verified Payment',
        status: 'captured',
        currency: 'INR',
        signatureHash: sig,
        authorizedAt: new Date().toISOString(),
      };
      
      handlePaymentAuthorized(receipt, orderId);
      // Remove query params to prevent re-processing on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);


  const validateShippingFields = (): string | null => {
    if (items.length === 0) {
      return 'Your shopping bag is empty. Please add items before checking out.';
    }
    if (!form.name.trim() || form.name.trim().length < 2) {
      return 'Please enter your full name in Shipping Details.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Please enter a valid email address for your encrypted payment receipt.';
    }
    if (!form.address.trim() || form.address.trim().length < 5) {
      return 'Please enter your complete delivery address.';
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      return 'Please enter a valid 10-digit mobile number for delivery updates.';
    }
    return null;
  };

  const handlePaymentAuthorized = async (receipt: PaymentReceiptInfo, orderReference: string) => {
    setFirestoreError(null);
    const paidTotal = total;

    const orderPayload: Order = {
      id: orderReference,
      userId: user ? user.uid : 'guest',
      customerInfo: {
        name: form.name.trim().slice(0, 100),
        email: form.email.trim().slice(0, 100),
        address: form.address.trim().slice(0, 500),
        phone: form.phone.trim().slice(0, 25),
      },
      items: items.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      total: paidTotal,
      status: 'placed',
      paymentInfo: receipt,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'orders', orderReference), orderPayload);
    } catch (err) {
      console.error('Order persistence warning:', err);
      try {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderReference}`);
      } catch {
        setFirestoreError('Payment succeeded, though order cloud sync encountered an issue. Save your Order ID below.');
      }
    }

    // Always save to localStorage as a robust fallback
    try {
      const savedOrders = JSON.parse(localStorage.getItem('nivora_prime_orders') || '[]');
      const updatedOrders = [orderPayload, ...savedOrders];
      localStorage.setItem('nivora_prime_orders', JSON.stringify(updatedOrders.slice(0, 50)));
    } catch (e) {
      console.error('Local storage order save error:', e);
    }

    setCompletedOrder({
      orderId: orderReference,
      paidAmountInr: paidTotal,
      receipt,
    });
    clearCart();
  };

  if (completedOrder) {
    const { orderId, paidAmountInr, receipt } = completedOrder;
    return (
      <div className="pt-36 pb-24 min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-xl w-full space-y-8 border border-stone-200"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-3xl font-bold text-stone-900">Payment Verified & Order Placed</h1>
            <p className="text-sm text-stone-500">
              Your transaction has been cryptographically verified and tokenized.
            </p>
          </div>

          {firestoreError && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              {firestoreError}
            </div>
          )}

          {/* Encrypted Payment Receipt Summary */}
          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200/80 space-y-3.5 text-sm">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Encrypted Payment Receipt</span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <Lock size={10} /> PCI DSS Verified
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Order Reference</span>
              <span className="font-mono font-bold text-stone-900 tabular-nums">{orderId}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Transaction ID</span>
              <span className="font-mono text-xs text-stone-800 tabular-nums">{receipt.transactionId}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Payment Method</span>
              <span className="font-semibold text-stone-900">{receipt.maskedInstrument}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Gateway</span>
              <span className="text-stone-800">{receipt.gateway}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">HMAC Signature</span>
              <span className="font-mono text-xs text-stone-500">{receipt.signatureHash.slice(0, 16)}…</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-stone-200 text-base font-bold">
              <span className="text-stone-900">Amount Paid</span>
              <span className="text-[#9A7B1C] tabular-nums">₹{paidAmountInr.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate(`/tracking?id=${orderId}`)}
              className="w-full py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10 cursor-pointer"
            >
              Track Your Order <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/shop')}
              className="w-full py-3 text-sm text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-stone-50 min-h-screen">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#9A7B1C] mb-2">Nivora Prime Checkout</p>
            <h1 className="text-4xl font-bold text-stone-900">Secure Checkout</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Lock size={12} className="text-emerald-600" />
            <span>TLS 1.3 End-to-End Encrypted · Zero Raw Card Storage</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-stone-100 text-center max-w-lg mx-auto space-y-5">
            <ShoppingBag size={32} className="mx-auto text-stone-300" strokeWidth={1.2} />
            <h2 className="text-2xl font-bold text-stone-900">Your Bag is Empty</h2>
            <p className="text-sm text-stone-500">Add skincare, luxury cosmetics, or jewelry to proceed to our encrypted payment gateway.</p>
            <Link to="/shop" className="inline-block px-8 py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-colors">
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Shipping + Multi-Method Payment Gateway */}
            <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl shadow-sm space-y-8 border border-stone-100">
              {!user && (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Have a Nivora Prime account?</p>
                    <p className="text-xs text-stone-500">Sign in with Gmail to pre-fill details and save orders to your profile, or continue as guest.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="px-4 py-2.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                  >
                    Sign In with Gmail
                  </button>
                </div>
              )}

              <div className="space-y-5">
                <h2 className="text-xl font-bold text-stone-900">1. Shipping & Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="ship-name" className="block text-xs font-semibold text-stone-700">Full Name</label>
                    <input
                      id="ship-name"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Priya Mehta"
                      className="w-full bg-stone-50 rounded-xl px-4 py-3.5 text-sm border border-stone-200 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ship-email" className="block text-xs font-semibold text-stone-700">Email Address</label>
                    <input
                      id="ship-email"
                      required
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="priya@example.com"
                      className="w-full bg-stone-50 rounded-xl px-4 py-3.5 text-sm border border-stone-200 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ship-address" className="block text-xs font-semibold text-stone-700">Complete Delivery Address</label>
                  <textarea
                    id="ship-address"
                    required
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="Flat 402, Imperial Towers, Bandra West, Mumbai, Maharashtra 400050"
                    className="w-full bg-stone-50 rounded-xl px-4 py-3.5 text-sm border border-stone-200 focus:border-[#D4AF37] focus:bg-white h-24 outline-none resize-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ship-phone" className="block text-xs font-semibold text-stone-700">Mobile Number (for OTP & Courier Updates)</label>
                  <input
                    id="ship-phone"
                    required
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-stone-50 rounded-xl px-4 py-3.5 text-sm font-mono tabular-nums border border-stone-200 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* 2. Multi-Method PCI DSS Compliant Payment Gateway */}
              <PaymentGateway
                amountInr={total}
                customerEmail={form.email}
                customerPhone={form.phone}
                disabled={items.length === 0}
                onValidateShipping={validateShippingFields}
                onPaymentAuthorized={handlePaymentAuthorized}
              />
            </div>

            {/* Right Column: Sticky Order Summary & Security Guarantees */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
              <div className="bg-stone-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-3xl" />
                <h2 className="text-xl font-bold mb-6 relative z-10">Order Summary</h2>
                <div className="space-y-5 max-h-80 overflow-y-auto pr-1 relative z-10">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-stone-400 tabular-nums">₹{item.price}</span>
                            <div className="flex items-center border border-white/30 rounded-lg overflow-hidden bg-white/10">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                className="p-2 hover:bg-white/20 text-white cursor-pointer transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="px-4 text-sm font-bold text-white tabular-nums">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                className="p-2 hover:bg-white/20 text-white cursor-pointer transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="font-mono text-sm tabular-nums text-white">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 space-y-3 relative z-10">
                  <div className="flex justify-between text-stone-400 text-sm">
                    <span>Subtotal</span>
                    <span className="tabular-nums">₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-400 text-sm">
                    <span>Express Insured Shipping</span>
                    <span className="text-[#D4AF37] font-bold">FREE</span>
                  </div>
                  <div className="flex justify-between text-stone-400 text-sm">
                    <span>Taxes (GST Included)</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-3 border-t border-white/10 text-[#D4AF37]">
                    <span>Total Payable</span>
                    <span className="tabular-nums">₹{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* PCI DSS Security Assurance Card */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 space-y-4">
                <div className="flex items-center gap-2.5 text-stone-900 font-semibold text-sm">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>Bank-Grade Payment Security</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  All transactions are processed over TLS 1.3 with AES-256-GCM encryption and 3D Secure 2.2 authentication. Nivora Prime adheres strictly to PCI DSS v4.0—raw card numbers and CVV codes never touch browser storage or merchant databases.
                </p>
                <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-stone-500">
                  <span>VISA</span>
                  <span>MASTERCARD</span>
                  <span>RUPAY</span>
                  <span>AMEX</span>
                  <span>NET BANKING</span>
                  <span>PAYTM</span>
                  <span>PHONEPE</span>
                  <span>AMAZON PAY</span>
                  <span>BHIM UPI</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OrderTracking = () => {
  const [searchId, setSearchId] = useState('');
  const [activeOrderId, setActiveOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      const normalized = id.trim().toUpperCase();
      setSearchId(normalized);
      setActiveOrderId(normalized);
    }
  }, [location]);

  useEffect(() => {
    if (!user) {
      setRecentOrders([]);
      return;
    }
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => d.data() as Order)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRecentOrders(list);
      },
      (err) => {
        console.error('Order history listener error:', err);
      }
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (activeOrderId && activeOrderId.startsWith('ORD-')) {
      setLoading(true);
      const docRef = doc(db, 'orders', activeOrderId);
      unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setOrder(docSnap.data() as Order);
          } else {
            setOrder(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Order lookup error:', err);
          setOrder(null);
          setLoading(false);
        }
      );
    }
    return () => unsubscribe();
  }, [activeOrderId]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      setActiveOrderId(searchId.trim().toUpperCase());
    }
  };

  const steps = [
    { key: 'placed', label: 'Order Placed', icon: <ShoppingBag size={16} /> },
    { key: 'processing', label: 'Preparing Ritual', icon: <Filter size={16} /> },
    { key: 'shipped', label: 'In Transit', icon: <Truck size={16} /> },
    { key: 'delivered', label: 'Arrived', icon: <UserIcon size={16} /> },
  ];

  const activeIndex = order ? steps.findIndex(s => s.key === order.status) : -1;

  return (
    <div className="pt-36 pb-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 max-w-4xl space-y-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm space-y-10 border border-stone-100">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-stone-900">Track Your Ritual</h1>
            <p className="text-stone-500">Enter your Order ID to view real-time delivery status and verified payment details.</p>
            <form onSubmit={handleTrackSubmit} className="flex gap-2 max-w-md mx-auto pt-2">
              <input
                value={searchId}
                onChange={e => setSearchId(e.target.value.toUpperCase())}
                placeholder="ORD-XXXXXXXX"
                className="flex-1 bg-stone-50 rounded-xl px-5 py-3.5 border border-stone-200 focus:border-[#D4AF37] uppercase font-mono outline-none"
              />
              <button
                type="submit"
                className="bg-stone-900 text-white px-7 rounded-xl font-bold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D4AF37]" />
            </div>
          ) : order ? (
            <div className="space-y-10">
              <div className="grid grid-cols-3 gap-6 p-6 bg-stone-50 rounded-2xl border border-stone-100">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Order ID</p>
                  <p className="text-base font-mono font-bold text-stone-900 tabular-nums">{order.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Fulfillment Status</p>
                  <p className="text-base font-bold capitalize text-[#9A7B1C]">{order.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Estimated Arrival</p>
                  <p className="text-base font-bold text-stone-900">3–5 Business Days</p>
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="relative pt-8 pb-4">
                <div className="hidden sm:block absolute top-14 left-8 right-8 h-1 bg-stone-100" />
                <div className="relative grid grid-cols-4 gap-6">
                  {steps.map((step, i) => (
                    <div key={step.key} className="flex flex-col items-center gap-3 bg-white px-2 text-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors z-10 ${i <= activeIndex ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-100 text-stone-400'}`}>
                        {step.icon}
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${i <= activeIndex ? 'text-stone-900' : 'text-stone-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Content & Encrypted Payment Info */}
              <div className="pt-8 border-t border-stone-100 grid grid-cols-2 gap-10 text-left">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2">Shipping To</h3>
                    <div className="text-stone-600 space-y-1 text-sm">
                      <p className="font-bold text-stone-900">{order.customerInfo.name}</p>
                      <p>{order.customerInfo.address}</p>
                      <p className="font-mono tabular-nums">{order.customerInfo.phone}</p>
                      <p>{order.customerInfo.email}</p>
                    </div>
                  </div>

                  {order.paymentInfo && (
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-semibold text-stone-900">
                        <span className="flex items-center gap-1.5">
                          <CreditCard size={12} className="text-[#D4AF37]" /> Payment Details
                        </span>
                        <span className="text-emerald-700 capitalize">{order.paymentInfo.status}</span>
                      </div>
                      <p className="text-stone-600">
                        Method: <strong className="text-stone-900">{order.paymentInfo.maskedInstrument}</strong>
                      </p>
                      <p className="text-stone-600">
                        Gateway: <span className="text-stone-800">{order.paymentInfo.gateway}</span>
                      </p>
                      <p className="text-stone-500 font-mono tabular-nums">
                        Txn: {order.paymentInfo.transactionId}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-stone-900">Bag Items</h3>
                  <div className="space-y-3">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-stone-600">{item.name} <span className="text-stone-400 ml-1 font-bold">×{item.quantity}</span></span>
                        <span className="font-mono text-stone-900 font-bold tabular-nums">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-stone-100 flex justify-between font-bold text-lg text-stone-900">
                      <span>Total Paid</span>
                      <span className="text-[#9A7B1C] tabular-nums">₹{order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeOrderId ? (
            <div className="text-center py-14 text-stone-400">
              <Search size={32} className="mx-auto mb-3 opacity-30" />
              <p>No order found with ID <span className="font-mono text-stone-600">{activeOrderId}</span>. Please check and try again.</p>
            </div>
          ) : null}
        </div>

        {/* Signed-in User Recent Orders Quick Selector */}
        {user && recentOrders.length > 0 && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <h2 className="text-lg font-bold text-stone-900">Your Recent Orders</h2>
            <div className="divide-y divide-stone-100">
              {recentOrders.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => {
                    setSearchId(ord.id);
                    setActiveOrderId(ord.id);
                  }}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-stone-50 px-3 rounded-xl transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-mono font-bold text-sm text-stone-900">{ord.id}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(ord.createdAt).toLocaleDateString()} · {ord.paymentInfo?.maskedInstrument || 'Paid'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-stone-900 tabular-nums">₹{ord.total.toFixed(2)}</p>
                    <p className="text-xs capitalize text-[#9A7B1C]">{ord.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, profile, loginWithGoogle, signup, updateUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [view, setView] = useState<'main' | 'history'>('main');
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('nivora_prime_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const needsProfileCompletion = user && (!profile || !profile.phone);

  useEffect(() => {
    if (user && !profile?.phone) {
      setName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && view === 'history') {
      const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedOrders = snapshot.docs.map(doc => doc.data() as Order);
        setOrders(fetchedOrders);
        // Sync with localStorage
        if (fetchedOrders.length > 0) {
          localStorage.setItem('nivora_prime_orders', JSON.stringify(fetchedOrders));
        }
      });
      return unsubscribe;
    }
  }, [user, view]);

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setProfileError(null);
    try {
      const docRef = doc(db, 'users', user.uid);
      const updatedProfile: UserProfile = {
        id: user.uid,
        name: (name || user.displayName || 'Nivora Member').slice(0, 100),
        email: (user.email || email).slice(0, 100),
        phone: phone.trim().slice(0, 25),
        ...(user.photoURL ? { avatar: user.photoURL } : {}),
        wishlist: profile?.wishlist || [],
      };
      await setDoc(docRef, updatedProfile);
      updateUserProfile(updatedProfile);
    } catch (err) {
      console.error(err);
      setProfileError('Unable to save profile details. Please check your inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 md:p-14 rounded-3xl shadow-xl max-w-lg w-full text-center space-y-8 border border-[#D4AF37]/20 relative overflow-hidden"
        >
          <div className="relative space-y-4">
            <div className="w-20 h-20 fiery-glow rounded-2xl flex items-center justify-center mx-auto shadow-lg text-white mb-6">
              <UserIcon size={24} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900">
              {isLoginMode ? 'Welcome Back' : 'Join Nivora Prime'}
            </h1>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
              {isLoginMode ? 'Sign in with your Gmail to continue your beauty ritual.' : 'Create your royal profile with Gmail for an exclusive experience.'}
            </p>
          </div>

          <div className="flex p-1 bg-stone-100 rounded-2xl max-w-[280px] mx-auto relative z-10">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(true);
                setProfileError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer ${isLoginMode ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(false);
                setProfileError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer ${!isLoginMode ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Sign Up
            </button>
          </div>

          {profileError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 text-left">
              <AlertCircle size={14} className="shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="space-y-6 relative z-10">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setProfileError(null);
                try {
                  if (!isLoginMode) {
                    await signup(email, name, phone);
                  } else {
                    await loginWithGoogle();
                  }
                } catch (err) {
                  console.error(err);
                  setProfileError('Authentication was cancelled or failed. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-4 text-left"
            >
              {!isLoginMode && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nivora Member"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Gmail Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-gmail@gmail.com"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 focus:border-[#D4AF37] focus:bg-white outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 fiery-glow text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 brightness-0 invert" alt="Google" />
                {isSubmitting ? 'Authenticating...' : (isLoginMode ? 'Sign In with Gmail' : 'Join with Gmail')}
              </button>
            </form>
          </div>

          <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-900 transition-colors underline decoration-stone-200 underline-offset-4 cursor-pointer">
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  if (needsProfileCompletion) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 md:p-14 rounded-3xl shadow-xl max-w-lg w-full text-center space-y-8 border border-[#D4AF37]/20"
        >
          <div className="w-20 h-20 bg-stone-50 text-[#D4AF37] rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle size={42} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">Complete Your Profile</h1>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
              Add your mobile number to enable instant checkout and real-time order tracking.
            </p>
          </div>

          {profileError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left">
              {profileError}
            </div>
          )}

          <form onSubmit={handleCompleteProfile} className="space-y-5 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 focus:border-[#D4AF37] outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 focus:border-[#D4AF37] outline-none"
                required
              />
            </div>
            <button
              disabled={isSubmitting}
              className="w-full py-4 fiery-glow text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Complete Profile'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-40 pb-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-stone-100 relative overflow-hidden"
        >
          {view === 'main' ? (
            <div className="flex flex-col items-center space-y-8">
              <div className="absolute top-0 left-0 w-full h-32 bg-stone-900" />
              <div className="relative group mt-10">
                <div className="w-36 h-36 rounded-3xl overflow-hidden border-8 border-white shadow-xl">
                  <img
                    src={profile?.avatar || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    alt={profile?.name || user.displayName || 'Member'}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-3xl font-bold text-stone-900">{profile?.name || user.displayName}</h1>
                <p className="text-stone-500 font-medium">{user.email}</p>
                {profile?.phone && (
                  <p className="mt-2 text-xs font-mono font-semibold text-[#9A7B1C] tabular-nums">
                    {profile.phone}
                  </p>
                )}
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <button
                  onClick={() => setView('history')}
                  className="p-6 bg-stone-50 rounded-2xl flex items-center justify-between group hover:bg-stone-900 hover:text-white transition-all text-stone-900 cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#D4AF37] group-hover:text-white group-hover:bg-white/10">
                      <ShoppingBag size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-base">Order History</p>
                      <p className="text-xs opacity-60">View all past rituals</p>
                    </div>
                  </div>
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => logout()}
                  className="p-6 bg-stone-50 rounded-2xl flex items-center justify-between group hover:bg-red-600 hover:text-white transition-all text-red-600 cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:bg-white/10">
                      <X size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-base">Log Out</p>
                      <p className="text-xs opacity-60">Securely exit your session</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-stone-100 pb-6">
                <button onClick={() => setView('main')} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors cursor-pointer group">
                  <X size={20} className="group-hover:rotate-90 transition-transform" />
                  <span className="text-sm font-bold uppercase tracking-widest">Back to Profile</span>
                </button>
                <h2 className="text-2xl font-bold text-stone-900">Order History</h2>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <ShoppingBag size={48} className="mx-auto text-stone-200" strokeWidth={1} />
                  <p className="text-stone-500">You haven't placed any orders yet.</p>
                  <Link to="/shop" className="inline-block px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors">Start Shopping</Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => (
                    <div 
                      key={order.id} 
                      onClick={() => navigate(`/tracking?id=${order.id}`)}
                      className="group p-6 rounded-2xl bg-stone-50 border border-stone-200 hover:border-[#D4AF37]/40 hover:bg-white hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-stone-900">{order.id}</span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
                            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <div className="flex -space-x-2 overflow-hidden pt-1">
                            {order.items.slice(0, 4).map((item, i) => {
                              const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
                              return (
                                <div key={i} className="inline-block h-10 w-10 rounded-lg ring-2 ring-white overflow-hidden bg-stone-200">
                                  <img src={product?.image || '/placeholder.jpg'} alt={item.name} className="h-full w-full object-cover" />
                                </div>
                              );
                            })}
                            {order.items.length > 4 && (
                              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-stone-900 text-white text-[10px] font-bold ring-2 ring-white">
                                +{order.items.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col justify-between items-end text-right">
                          <p className="text-lg font-bold text-stone-900 tabular-nums">₹{order.total.toFixed(2)}</p>
                          <button className="text-xs font-bold text-[#D4AF37] group-hover:underline flex items-center gap-1">
                            Track Order <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};



// --- Root App ---

const AppContent = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative">
      <Navbar onOpenCart={() => setIsCartOpen(true)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/tracking" element={<OrderTracking />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wishlist" element={<Wishlist />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const Footer = () => (
  <footer className="bg-stone-900 text-stone-400 py-20 border-t border-stone-800">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white tracking-tight">NIVORA PRIME</h3>
          <p className="text-sm leading-relaxed max-w-xs">
            Redefining luxury beauty and artisanal jewelry through botanical excellence and certified payment security.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Collection</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/shop" className="hover:text-white transition-colors">Skincare</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">Makeup</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">Fragrance</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">Jewelry</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">Apparel</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Customer Care</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/tracking" className="hover:text-white transition-colors">Track Order</Link></li>
            <li><Link to="/wishlist" className="hover:text-white transition-colors">Saved Wishlist</Link></li>
            <li><Link to="/checkout" className="hover:text-white transition-colors">Secure Checkout</Link></li>
            <li><Link to="/profile" className="hover:text-white transition-colors">Member Account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Accepted Payments</h4>
          <p className="text-xs leading-relaxed mb-4">
            256-bit TLS 1.3 encrypted & PCI DSS v4.0 compliant payments across India:
          </p>
          <p className="text-xs text-stone-300 font-medium leading-relaxed">
            Visa · Mastercard · RuPay · Amex · Net Banking (HDFC, ICICI, SBI, Axis) · Paytm · PhonePe · Amazon Pay · UPI
          </p>
        </div>
      </div>
      <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <p>© 2026 Nivora Prime. All rights reserved.</p>
        <p className="flex items-center gap-1.5 text-stone-400">
          <Lock size={12} className="text-[#D4AF37]" /> PCI DSS Level 1 Tokenized Gateway
        </p>
      </div>
    </div>
  </footer>
);

const WISHLIST_STORAGE_KEY = 'nivora_prime_wishlist';
const CART_STORAGE_KEY = 'nivora_prime_cart';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [wishlistItems, setWishlistItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [wishlistItems]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            if (data.wishlist && data.wishlist.length > 0) {
              setWishlistItems(prev => Array.from(new Set([...prev, ...(data.wishlist || [])])));
            }
          }
        } catch (err) {
          console.error('Profile fetch error:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const docRef = doc(db, 'users', u.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const newProfile: UserProfile = {
          id: u.uid,
          name: (u.displayName || 'Nivora Member').slice(0, 100),
          email: (u.email || '').slice(0, 100),
          ...(u.photoURL ? { avatar: u.photoURL } : {}),
          wishlist: wishlistItems,
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      } else {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        if (data.wishlist) {
          setWishlistItems(prev => Array.from(new Set([...prev, ...(data.wishlist || [])])));
        }
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  const signup = async (email: string, name: string, phone: string) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const u = result.user;
    const docRef = doc(db, 'users', u.uid);
    const profileData: UserProfile = {
      id: u.uid,
      name: (name || u.displayName || 'Nivora Member').slice(0, 100),
      email: (u.email || email).slice(0, 100),
      phone: phone.trim().slice(0, 25),
      ...(u.photoURL ? { avatar: u.photoURL } : {}),
      wishlist: wishlistItems,
    };
    await setDoc(docRef, profileData);
    setProfile(profileData);
  };

  const updateUserProfile = (updated: UserProfile) => {
    setProfile(updated);
  };

  const logout = () => signOut(auth);

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(item => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => setCartItems([]);
  const total = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const toggleWishlist = async (productId: string) => {
    const next = wishlistItems.includes(productId)
      ? wishlistItems.filter(id => id !== productId)
      : [...wishlistItems, productId];

    setWishlistItems(next);
    if (user && profile) {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { ...profile, wishlist: next });
        setProfile({ ...profile, wishlist: next });
      } catch (err) {
        console.error('Wishlist cloud sync error:', err);
      }
    }
  };

  const isInWishlist = (productId: string) => wishlistItems.includes(productId);

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, signup, updateUserProfile, logout }}>
      <CartContext.Provider value={{ items: cartItems, addToCart, updateQuantity, removeFromCart, clearCart, total }}>
        <WishlistContext.Provider value={{ items: wishlistItems, toggleWishlist, isInWishlist }}>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </WishlistContext.Provider>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}
