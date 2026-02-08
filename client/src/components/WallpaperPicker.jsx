/**
 * Wallpaper Picker Component
 * 
 * Modal for selecting chat wallpapers - presets, colors, or custom images
 */

import { useState, useRef } from 'react';
import { PRESET_WALLPAPERS, setWallpaper, imageToDataURL } from '../utils/wallpaperManager';
import './Modal.css';
import './WallpaperPicker.css';

export default function WallpaperPicker({ chatId, currentWallpaper, onSelect, onClose }) {
    const [selectedWallpaper, setSelectedWallpaper] = useState(currentWallpaper);
    const [customColor, setCustomColor] = useState('#1a1a2e');
    const fileInputRef = useRef(null);

    const handlePresetSelect = (preset) => {
        setSelectedWallpaper(preset);
    };

    const handleColorChange = (e) => {
        const color = e.target.value;
        setCustomColor(color);
        setSelectedWallpaper({
            id: 'custom-color',
            name: 'Custom Color',
            type: 'solid',
            value: color
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await imageToDataURL(file);
            setSelectedWallpaper({
                id: 'custom-image',
                name: 'Custom Image',
                type: 'image',
                value: dataUrl
            });
        } catch (error) {
            console.error('Failed to load image:', error);
        }
    };

    const handleApply = async () => {
        await setWallpaper(chatId, selectedWallpaper);
        onSelect(selectedWallpaper);
        onClose();
    };

    const getWallpaperStyle = (wallpaper) => {
        if (wallpaper.type === 'image') {
            return { backgroundImage: `url(${wallpaper.value})`, backgroundSize: 'cover' };
        } else if (wallpaper.type === 'gradient') {
            return { background: wallpaper.value };
        } else {
            return { backgroundColor: wallpaper.value };
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content wallpaper-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Chat Wallpaper</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Preview */}
                    <div className="wallpaper-preview" style={getWallpaperStyle(selectedWallpaper)}>
                        <div className="preview-bubble theirs">Hello!</div>
                        <div className="preview-bubble mine">Hey there!</div>
                    </div>

                    {/* Presets */}
                    <div className="wallpaper-section">
                        <h3>Presets</h3>
                        <div className="wallpaper-grid">
                            {PRESET_WALLPAPERS.map(preset => (
                                <button
                                    key={preset.id}
                                    className={`wallpaper-item ${selectedWallpaper?.id === preset.id ? 'active' : ''}`}
                                    style={getWallpaperStyle(preset)}
                                    onClick={() => handlePresetSelect(preset)}
                                    title={preset.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Custom options */}
                    <div className="wallpaper-section">
                        <h3>Custom</h3>
                        <div className="custom-options">
                            <div className="color-picker-wrapper">
                                <label>
                                    <span className="color-label">🎨 Color</span>
                                    <input
                                        type="color"
                                        value={customColor}
                                        onChange={handleColorChange}
                                        className="color-picker"
                                    />
                                </label>
                            </div>
                            <button
                                className="upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📷 Upload Image
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="apply-btn" onClick={handleApply}>Apply</button>
                </div>
            </div>
        </div>
    );
}
