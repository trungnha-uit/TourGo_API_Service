const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.register = async (req, res) => {
    try {
        const {name, email, password} = req.body;

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
                phone: null
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