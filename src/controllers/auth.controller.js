const supabase = require('../config/supabase');
const supabaseAuth = require('../config/supabaseAuth');
const ERROR_CODES = require('../constants/errorCodes');

exports.register = async (req, res) => {
    try {
        const { name, email, password, location } = req.body;

        const { data: authData, error: authError } =
            await supabaseAuth.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name
                    },

            emailRedirectTo: 'tourgo://auth/confirm'
        }
    });

        if (authError) {
            const message = authError.message.toLowerCase();
            let errorCode = ERROR_CODES.SERVER_ERROR;
            let statusCode = 400;
            let userMessage = authError.message;

            if (message.includes('already registered')) {
                errorCode = ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS;
            } else if (message.includes('rate limit')) {
                // Supabase's built-in email service caps confirmation emails per
                // hour. Once exhausted, signUp fails with "email rate limit
                // exceeded" — surface it as a clear 429 instead of a generic
                // "server error" so the user knows to retry later.
                errorCode = ERROR_CODES.RATE_LIMIT;
                statusCode = 429;
                userMessage = 'Hệ thống đang gửi quá nhiều email xác thực. Vui lòng thử lại sau vài phút.';
            } else if (message.includes('password')) {
                errorCode = ERROR_CODES.AUTH_WEAK_PASSWORD;
            }

            return res.status(statusCode).json({
                success: false,
                data: null,
                error: errorCode,
                message: userMessage
            });
        }

        // cập nhật bảng users
        const { error: updateError } =
            await supabase
                .from('users')
                .update({
                    name,
                    email,
                    role: 'user',
                    avatar: null,
                    phone: null,
                    location: location || null
                })
                .eq('id', authData.user.id);

        if (updateError) {
            console.error(updateError);

            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message:
                    'Failed to update user profile'
            });
        }

        return res.status(201).json({
            success: true,

            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    name,
                    role: 'user',

                    // frontend biết đã verify chưa
                    emailVerified:
                        !!authData.user.email_confirmed_at
                },

                // signup có thể null
                session:
                    authData.session
                        ? {
                              access_token:
                                  authData.session.access_token,

                              refresh_token:
                                  authData.session.refresh_token,

                              expires_at:
                                  authData.session.expires_at,

                              token_type:
                                  authData.session.token_type
                          }
                        : null
            },

            error: null,

            message:
                'Registration successful. Please check your email to verify your account.'
        });

    } catch (error) {
        console.error('Register error:', error);

        return res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const {email, password} = req.body;

        const {data: authData, error: authError} = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            if (authError.message.includes('not confirmed') || authError.message.toLowerCase().includes('email not confirmed')) {
                return res.status(403).json({
                    success: false,
                    data: null,
                    error: 'AUTH_EMAIL_NOT_CONFIRMED',
                    message: 'Vui lòng xác thực email trước khi đăng nhập.'
                });
            }
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                message: 'Invalid email or password'
            });
        }

        // Fetch user profile from public.users table
        const { data: userProfile } = await supabase
            .from('users')
            .select('name, role, status')
            .eq('id', authData.user.id)
            .single();

        // Block suspended accounts — the moderation status lives in public.users,
        // not in the Supabase auth user, so it must be checked here.
        if (userProfile && userProfile.status === 'suspended') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.ACCOUNT_SUSPENDED,
                message: 'Tài khoản của bạn đã bị tạm khoá. Vui lòng liên hệ quản trị viên.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    name: userProfile ? userProfile.name : '',
                    role: userProfile ? userProfile.role : 'user'
                },
                session: {
                    access_token: authData.session.access_token,
                    refresh_token: authData.session.refresh_token,
                    expires_at: authData.session.expires_at,
                    token_type: authData.session.token_type
                }
            },
            error: null,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'VALIDATION_ERROR',
                message: 'Email is required'
            });
        }

       const { error } = await supabaseAuth.auth.resend({
        type: 'signup',
        email,

        options: {
        emailRedirectTo: 'tourgo://auth/confirm'
    }
});

        if (error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'RESEND_FAILED',
                message: error.message
            });
        }

        return res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Verification email resent successfully'
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

/**
 * Social login (Google / Facebook).
 *
 * The client signs in with the provider natively and sends us the provider's
 * OIDC id_token. Google returns an id_token directly; Facebook must use
 * "Limited Login" so the client also yields an OIDC id_token. We exchange it
 * for a Supabase session and return the SAME shape as `login`, so the mobile
 * app reuses its existing session handling.
 *
 * Body: { provider: 'google' | 'facebook', token: <provider id_token> }
 *
 * Requires the matching provider to be enabled in the Supabase dashboard
 * (Authentication > Providers) with the client IDs registered there.
 */
exports.socialLogin = async (req, res) => {
    try {
        const {provider, token} = req.body;

        if (!provider) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_PROVIDER,
                message: 'Provider is required'
            });
        }

        if (!token) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_TOKEN,
                message: 'Provider token is required'
            });
        }

        const SUPPORTED_PROVIDERS = ['google', 'facebook'];
        if (!SUPPORTED_PROVIDERS.includes(provider)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_PROVIDER,
                message: `Unsupported provider: ${provider}`
            });
        }

        const {data, error} = await supabaseAuth.auth.signInWithIdToken({
            provider,
            token
        });

        if (error || !data || !data.session) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.SOCIAL_LOGIN_FAILED,
                message: error ? error.message : 'Social login failed'
            });
        }

        // Block suspended accounts — same check as the email/password path, since
        // social login bypasses it entirely otherwise.
        const { data: socialProfile } = await supabase
            .from('users')
            .select('status')
            .eq('id', data.user.id)
            .single();

        if (socialProfile && socialProfile.status === 'suspended') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.ACCOUNT_SUSPENDED,
                message: 'Tài khoản của bạn đã bị tạm khoá. Vui lòng liên hệ quản trị viên.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: data.user.id,
                    email: data.user.email
                },
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                    token_type: data.session.token_type
                }
            },
            error: null,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const {email} = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_EMAIL,
                message: 'Email is required'
            });
        }

        const {error} = await supabaseAuth.auth.resetPasswordForEmail(email, {
            redirectTo: 'tourgo://reset'
        });

        if (error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.RESET_PASSWORD_FAILED,
                message: 'Failed to send password reset email'
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Password reset email sent successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.refreshToken = async (req, res) => {
    try {
        const {refresh_token} = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_REFRESH_TOKEN,
                message: 'Refresh token is required'
            });
        }

        const {data, error} = await supabaseAuth.auth.refreshSession({
            refresh_token
        });

        if (error) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_REFRESH_TOKEN,
                message: 'Invalid refresh token'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: data.user.id,
                    email: data.user.email
                },
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                    token_type: data.session.token_type
                }
            },
            error: null,
            message: 'Token refreshed successfully'
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_AUTH_HEADER,
                message: 'Authorization header is required'
            });
        }

        const {error} = await supabaseAuth.auth.signOut();

        if(error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: 'Failed to log out'
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.updatePassword = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_PASSWORD,
                message: 'Password is required'
            });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_AUTH_HEADER,
                message: 'Authorization header is required'
            });
        }

        const token = authHeader.substring(7);

        const { data, error } = await supabaseAuth.auth.updateUser(
            { password },
            { accessToken: token }
        );

        if (error) {
            let errorCode = ERROR_CODES.SERVER_ERROR;

            if (error.message.includes('same as the old password')) {
                errorCode = ERROR_CODES.PASSWORD_SAME_AS_OLD;
            } else if (error.message.includes('Invalid token')) {
                errorCode = ERROR_CODES.INVALID_TOKEN;
            }

            return res.status(400).json({
                success: false,
                data: null,
                error: errorCode,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}