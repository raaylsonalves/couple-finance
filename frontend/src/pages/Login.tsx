import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = isLogin
        ? await signIn({ email, password })
        : await signUp({ email, password });

      if (error) throw error;

      if (isLogin) {
        navigate('/dashboard');
      } else {
        setError("Conta criada com sucesso! Verifique seu email ou tente fazer login.");
      }
    } catch (err) {
      const message = (err as Error).message || 'Ocorreu um erro durante a autenticação';
      console.error('[Auth Error]', message, err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nubank-dark text-white flex flex-col justify-center px-6">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-4xl font-bold mb-2">Finance</h1>
        <p className="text-nubank-gray mb-10 text-lg">Controle seus gastos juntos.</p>

        {error && (
          <div className="bg-red-500/20 text-red-200 p-3 rounded-lg flex items-center mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 mb-8">
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full bg-white/10 p-4 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white transition-all disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full bg-white/10 p-4 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-nubank-dark font-bold text-lg py-4 rounded-full mb-4 flex justify-center items-center gap-2 hover:bg-gray-100 transition-colors disabled:opacity-75"
          >
            {loading && <Loader2 className="animate-spin w-5 h-5" />}
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(null); }}
          className="w-full font-semibold text-white/80 py-4 hover:text-white transition-colors"
        >
          {isLogin ? 'Não tem uma conta? Criar conta' : 'Já tem uma conta? Entrar'}
        </button>
      </div>
    </div>
  );
};

export default Login;
