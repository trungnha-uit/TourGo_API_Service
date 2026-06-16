const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.register = async (req, res) => {
    try {
        const {name, email, password, location} = req.body;

        const {data: authData, error: authError} = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name  
                }
            }
        });

        if (authError) {
            let errorCode = ERROR_CODES.SERVER_ERROR;

            if(authError.message.includes('already registered')) {
                errorCode = ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS;
            } else if(authError.message.includes('password')) {
                errorCode = ERROR_CODES.AUTH_WEAK_PASSWORD;
            }

            return res.status(400).json({
                success: false,
                data: null,
                error: errorCode,
                message: authError.message
            });
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        const {error: updateError} = await supabase
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

        if(updateError) {
            console.error('Failed to update user profile:', updateError);
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: 'Failed to update user profile'
            });
        }

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    name: name,
                    role: 'user'
                },
                session: {
                    access_token: authData.session.access_token,
                    refresh_token: authData.session.refresh_token,
                    expires_at: authData.session.expires_at,
                    token_type: authData.session.token_type
                }
            },
            error: null,
            message: 'Registration successful'
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.login = async (req, res) => {
    try {
        const {email, password} = req.body;

        const {data: authData, error: authError} = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                message: 'Invalid email or password'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email
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

        const {data, error} = await supabase.auth.signInWithIdToken({
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

        const {error} = await supabase.auth.resetPasswordForEmail(email, {
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

        const {data, error} = await supabase.auth.refreshSession({
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

        const {error} = await supabase.auth.signOut();

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

        const { data, error } = await supabase.auth.updateUser(
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